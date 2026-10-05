// KOIoT Paneel - Historie (M2 §7.3). Laatste 50 paneel-invoeren. Geen HTTP.
#include "ui/screen_history.h"

#include <cstdio>
#include <cstring>
#include <ctime>

#include "esp_heap_caps.h"
#include "esp_log.h"
#include "lvgl.h"

#include "app_config.h"
#include "core/app_state.h"
#include "data/measurement_queue.h"
#include "data/param_catalog.h"
#include "data/status_store.h"
#include "ui/ui_chrome.h"

static const char* TAG = "screen_hist";

static const lv_color_t COL_BG     = lv_color_hex(0x0E1216);
static const lv_color_t COL_TEXT   = lv_color_hex(0xE6EDF3);
static const lv_color_t COL_MUTED  = lv_color_hex(0x8B9AA8);
static const lv_color_t COL_ORANGE = lv_color_hex(0xF39C12);
static const lv_color_t COL_BLUE   = lv_color_hex(0x3498DB);
static const lv_color_t COL_GREEN  = lv_color_hex(0x2ECC71);
static const lv_color_t COL_BTN    = lv_color_hex(0x2A3540);
static const lv_color_t COL_CARD   = lv_color_hex(0x1B2229);
static const lv_color_t COL_BORDER = lv_color_hex(0x2E3A45);
static const lv_color_t COL_DIM    = lv_color_hex(0x000000);

static const char* MONTHS_NL[12] = {"jan", "feb", "mrt", "apr", "mei", "jun",
                                    "jul", "aug", "sep", "okt", "nov", "dec"};

static lv_obj_t* s_scr = nullptr;
static UiStatusBar s_status;
static UiNav s_nav;
static lv_obj_t* s_list = nullptr;
static lv_obj_t* s_empty = nullptr;
static lv_obj_t* s_rows[k_meas_history_n] = {};
static lv_obj_t* s_row_lbl[k_meas_history_n] = {};
static int s_built = 0;
static bool s_visible = false;
static void on_row(lv_event_t* e);

static void build_one_row()
{
    if (s_built >= k_meas_history_n || s_list == nullptr) {
        return;
    }
    const int i = s_built;
    lv_obj_t* row = lv_obj_create(s_list);
    if (row == nullptr) {
        return;
    }
    lv_obj_set_width(row, LV_PCT(100));
    lv_obj_set_height(row, 64);
    lv_obj_set_style_bg_color(row, COL_CARD, 0);
    lv_obj_set_style_bg_opa(row, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(row, COL_BORDER, 0);
    lv_obj_set_style_border_width(row, 2, 0);
    lv_obj_set_style_radius(row, 10, 0);
    lv_obj_set_style_pad_all(row, 8, 0);
    lv_obj_remove_flag(row, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(row, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(row, on_row, LV_EVENT_CLICKED,
                        reinterpret_cast<void*>(static_cast<intptr_t>(i)));
    lv_obj_add_flag(row, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(row, LV_OBJ_FLAG_IGNORE_LAYOUT);
    lv_obj_t* lbl = lv_label_create(row);
    lv_obj_set_width(lbl, LV_PCT(100));
    lv_label_set_long_mode(lbl, LV_LABEL_LONG_DOT);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(lbl, COL_TEXT, 0);
    lv_obj_remove_flag(lbl, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_align(lbl, LV_ALIGN_LEFT_MID, 4, 0);
    s_rows[i] = row;
    s_row_lbl[i] = lbl;
    s_built++;
}
static MeasSnapshot* s_snap = nullptr;

static lv_obj_t* s_dim = nullptr;
static lv_obj_t* s_pop_title = nullptr;
static lv_obj_t* s_pop_val = nullptr;
static lv_obj_t* s_pop_meta = nullptr;
static lv_obj_t* s_pop_up = nullptr;
static int s_pop_i = -1;

static void close_pop()
{
    if (s_dim != nullptr) {
        lv_obj_add_flag(s_dim, LV_OBJ_FLAG_HIDDEN);
    }
    s_pop_i = -1;
}

static void on_dim(lv_event_t*)
{
    close_pop();
}

static void on_close(lv_event_t*)
{
    close_pop();
}

static void open_pop(int i)
{
    if (s_snap == nullptr || i < 0 || i >= s_snap->history_n || s_dim == nullptr) {
        return;
    }
    const MeasItem& it = s_snap->history[i];
    const ParamDef* p = param_catalog_get(it.param);
    const int u = (p != nullptr && it.unit < p->unit_count) ? it.unit : 0;
    lv_label_set_text(s_pop_title, p != nullptr ? p->label : "Meting");
    char num[24];
    ui_format_nl(num, sizeof(num), it.value, p != nullptr ? p->decimals[u] : 2);
    const char* unit = (p != nullptr && p->units[u] != nullptr) ? p->units[u] : "";
    lv_label_set_text_fmt(s_pop_val, "%s %s", num, unit);
    char when[48] = "";
    if (it.measured_at >= 1700000000) {
        const time_t t = static_cast<time_t>(it.measured_at);
        struct tm tm_l = {};
        localtime_r(&t, &tm_l);
        if (tm_l.tm_mon >= 0 && tm_l.tm_mon < 12) {
            snprintf(when, sizeof(when), "Gemeten  %d %s %d %02d:%02d",
                     tm_l.tm_mday, MONTHS_NL[tm_l.tm_mon], tm_l.tm_year + 1900,
                     tm_l.tm_hour, tm_l.tm_min);
        }
    }
    lv_label_set_text(s_pop_meta, when[0] ? when : "Bron  paneel");
    if (it.status == MeasStatus::Uploaded) {
        lv_label_set_text(s_pop_up, "Upload  geupload");
        lv_obj_set_style_text_color(s_pop_up, COL_MUTED, 0);
    } else if (it.status == MeasStatus::Rejected) {
        lv_label_set_text_fmt(s_pop_up, "Upload  afgewezen  %s", it.reject);
        lv_obj_set_style_text_color(s_pop_up, COL_ORANGE, 0);
    } else {
        lv_label_set_text(s_pop_up, "Upload  in wachtrij");
        lv_obj_set_style_text_color(s_pop_up, COL_ORANGE, 0);
    }
    s_pop_i = i;
    lv_obj_remove_flag(s_dim, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(s_dim);
}

static void on_row(lv_event_t* e)
{
    const int i = static_cast<int>(reinterpret_cast<intptr_t>(lv_event_get_user_data(e)));
    open_pop(i);
}

lv_obj_t* screen_history_create()
{
    if (s_snap == nullptr) {
        s_snap = static_cast<MeasSnapshot*>(
            heap_caps_calloc(1, sizeof(MeasSnapshot), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    }
    s_scr = lv_obj_create(nullptr);
    lv_obj_set_size(s_scr, 1024, 600);
    lv_obj_set_style_bg_color(s_scr, COL_BG, 0);
    lv_obj_set_style_bg_opa(s_scr, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(s_scr, 0, 0);
    lv_obj_set_style_pad_all(s_scr, 0, 0);
    lv_obj_remove_flag(s_scr, LV_OBJ_FLAG_SCROLLABLE);

    s_status = ui_status_bar_create(s_scr);

    s_list = lv_obj_create(s_scr);
    lv_obj_set_pos(s_list, 12, APP_UI_STATUS_H + 8);
    lv_obj_set_size(s_list, 1000, 600 - APP_UI_STATUS_H - APP_UI_NAV_H - 16);
    lv_obj_set_style_bg_opa(s_list, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(s_list, 0, 0);
    lv_obj_set_style_pad_all(s_list, 0, 0);
    lv_obj_set_style_pad_row(s_list, 6, 0);
    lv_obj_set_flex_flow(s_list, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_scroll_dir(s_list, LV_DIR_VER);
    lv_obj_remove_flag(s_list, LV_OBJ_FLAG_CLICKABLE);

    s_empty = ui_make_label(s_list, 0, 0, &lv_font_montserrat_20, COL_MUTED,
                            "Nog geen invoer vanaf dit paneel");

    s_nav = ui_nav_create(s_scr, 3);

    s_dim = lv_obj_create(s_scr);
    lv_obj_set_size(s_dim, 1024, 600);
    lv_obj_set_pos(s_dim, 0, 0);
    lv_obj_set_style_bg_color(s_dim, COL_DIM, 0);
    lv_obj_set_style_bg_opa(s_dim, LV_OPA_70, 0);
    lv_obj_set_style_border_width(s_dim, 0, 0);
    lv_obj_set_style_pad_all(s_dim, 0, 0);
    lv_obj_remove_flag(s_dim, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(s_dim, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(s_dim, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_event_cb(s_dim, on_dim, LV_EVENT_CLICKED, nullptr);

    lv_obj_t* box = lv_obj_create(s_dim);
    lv_obj_set_size(box, 720, 360);
    lv_obj_center(box);
    lv_obj_set_style_bg_color(box, COL_CARD, 0);
    lv_obj_set_style_border_color(box, COL_BORDER, 0);
    lv_obj_set_style_border_width(box, 2, 0);
    lv_obj_set_style_radius(box, 12, 0);
    lv_obj_set_flex_flow(box, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_style_pad_all(box, 16, 0);
    lv_obj_set_style_pad_row(box, 8, 0);
    lv_obj_remove_flag(box, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(box, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_remove_flag(box, LV_OBJ_FLAG_EVENT_BUBBLE);

    s_pop_title = lv_label_create(box);
    lv_obj_set_style_text_font(s_pop_title, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(s_pop_title, COL_BLUE, 0);
    lv_obj_remove_flag(s_pop_title, LV_OBJ_FLAG_CLICKABLE);
    s_pop_val = lv_label_create(box);
    lv_obj_set_style_text_font(s_pop_val, &lv_font_montserrat_42, 0);
    lv_obj_set_style_text_color(s_pop_val, COL_TEXT, 0);
    lv_obj_remove_flag(s_pop_val, LV_OBJ_FLAG_CLICKABLE);
    s_pop_meta = lv_label_create(box);
    lv_obj_set_style_text_font(s_pop_meta, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(s_pop_meta, COL_MUTED, 0);
    lv_obj_remove_flag(s_pop_meta, LV_OBJ_FLAG_CLICKABLE);
    s_pop_up = lv_label_create(box);
    lv_obj_set_style_text_font(s_pop_up, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(s_pop_up, COL_MUTED, 0);
    lv_obj_remove_flag(s_pop_up, LV_OBJ_FLAG_CLICKABLE);

    lv_obj_t* closeb = lv_obj_create(box);
    lv_obj_set_width(closeb, LV_PCT(100));
    lv_obj_set_height(closeb, 64);
    lv_obj_set_style_bg_color(closeb, COL_BTN, 0);
    lv_obj_set_style_border_color(closeb, COL_BORDER, 0);
    lv_obj_set_style_border_width(closeb, 2, 0);
    lv_obj_set_style_radius(closeb, 10, 0);
    lv_obj_set_style_pad_all(closeb, 0, 0);
    lv_obj_remove_flag(closeb, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(closeb, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(closeb, on_close, LV_EVENT_CLICKED, nullptr);
    lv_obj_t* cl = lv_label_create(closeb);
    lv_label_set_text(cl, "Sluiten");
    lv_obj_set_style_text_font(cl, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(cl, COL_TEXT, 0);
    lv_obj_remove_flag(cl, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_center(cl);

    ESP_LOGI(TAG, "historie-scherm klaar (rijen 1/tick)");
    return s_scr;
}

void screen_history_set_visible(bool visible)
{
    s_visible = visible;
    if (!visible) {
        close_pop();
    }
}

void screen_history_dismiss()
{
    close_pop();
}

bool screen_history_popup_open()
{
    return s_dim != nullptr && !lv_obj_has_flag(s_dim, LV_OBJ_FLAG_HIDDEN);
}

void screen_history_set_nav_badge(int open_tasks)
{
    ui_nav_set_badge(s_nav, open_tasks);
}

void screen_history_update(const AppState& st, const StatusSnapshot& app)
{
    if (s_scr == nullptr || !s_visible) {
        return;
    }
    ui_status_bar_update(s_status, st, app);
    ui_nav_set_badge(s_nav, app.due_now_count);
    if (s_built < k_meas_history_n) {
        build_one_row();
        return;
    }
    if (s_snap == nullptr) {
        return;
    }
    measurement_queue_snapshot(s_snap);
    if (s_snap->history_n <= 0) {
        if (s_empty != nullptr) {
            lv_obj_remove_flag(s_empty, LV_OBJ_FLAG_HIDDEN);
            lv_obj_remove_flag(s_empty, LV_OBJ_FLAG_IGNORE_LAYOUT);
        }
        for (int i = 0; i < k_meas_history_n; i++) {
            if (s_rows[i] != nullptr) {
                lv_obj_add_flag(s_rows[i], LV_OBJ_FLAG_HIDDEN);
                lv_obj_add_flag(s_rows[i], LV_OBJ_FLAG_IGNORE_LAYOUT);
            }
        }
        return;
    }
    if (s_empty != nullptr) {
        lv_obj_add_flag(s_empty, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(s_empty, LV_OBJ_FLAG_IGNORE_LAYOUT);
    }
    for (int i = 0; i < k_meas_history_n; i++) {
        if (s_rows[i] == nullptr) {
            continue;
        }
        if (i >= s_snap->history_n) {
            lv_obj_add_flag(s_rows[i], LV_OBJ_FLAG_HIDDEN);
            lv_obj_add_flag(s_rows[i], LV_OBJ_FLAG_IGNORE_LAYOUT);
            continue;
        }
        const MeasItem& it = s_snap->history[i];
        const ParamDef* p = param_catalog_get(it.param);
        const int u = (p != nullptr && it.unit < p->unit_count) ? it.unit : 0;
        char num[24];
        ui_format_nl(num, sizeof(num), it.value, p != nullptr ? p->decimals[u] : 2);
        const char* unit = (p != nullptr && p->units[u] != nullptr) ? p->units[u] : "";
        char when[24] = "--:--";
        if (it.measured_at >= 1700000000) {
            const time_t t = static_cast<time_t>(it.measured_at);
            struct tm tm_l = {};
            localtime_r(&t, &tm_l);
            snprintf(when, sizeof(when), "%02d:%02d", tm_l.tm_hour, tm_l.tm_min);
        }
        const char* stt = "wacht";
        lv_color_t c = COL_ORANGE;
        if (it.status == MeasStatus::Uploaded) {
            stt = "geupload";
            c = COL_GREEN;
        } else if (it.status == MeasStatus::Rejected) {
            stt = "afgewezen";
            c = COL_ORANGE;
        }
        lv_label_set_text_fmt(s_row_lbl[i], "%s  %s  %s %s  %s",
                              when, p != nullptr ? p->label : "?", num, unit, stt);
        lv_obj_set_style_text_color(s_row_lbl[i], c, 0);
        lv_obj_remove_flag(s_rows[i], LV_OBJ_FLAG_HIDDEN);
        lv_obj_remove_flag(s_rows[i], LV_OBJ_FLAG_IGNORE_LAYOUT);
        lv_obj_remove_flag(s_row_lbl[i], LV_OBJ_FLAG_CLICKABLE);
    }
    if (s_pop_i >= 0) {
        open_pop(s_pop_i);
    }
}
