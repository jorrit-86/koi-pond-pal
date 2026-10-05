// KOIoT Paneel - rustscherm (implementatie).
#include "ui/screen_idle.h"

#include <cstdio>
#include <ctime>

#include "esp_random.h"
#include "esp_timer.h"
#include "lvgl.h"

#include "app_config.h"
#include "core/app_state.h"
#include "data/live_store.h"
#include "data/status_store.h"
#include "ui/ui_chrome.h"

static const lv_color_t COL_BG    = lv_color_hex(0x07090B);
static const lv_color_t COL_TEXT  = lv_color_hex(0xE6EDF3);
static const lv_color_t COL_MUTED = lv_color_hex(0x8B9AA8);
static const lv_color_t COL_ORANGE = lv_color_hex(0xF39C12);

static constexpr int k_block_w = 520;
static constexpr int k_block_h = 280;
static constexpr int k_base_x = (1024 - k_block_w) / 2;
static constexpr int k_base_y = (600 - k_block_h) / 2;

static lv_obj_t* s_scr = nullptr;
static lv_obj_t* s_block = nullptr;
static lv_obj_t* s_clock = nullptr;
static lv_obj_t* s_water = nullptr;
static lv_obj_t* s_water_meta = nullptr;
static lv_obj_t* s_tasks = nullptr;
static int64_t s_last_shift_us = 0;

static int clamp_i(int v, int lo, int hi)
{
    if (v < lo) {
        return lo;
    }
    if (v > hi) {
        return hi;
    }
    return v;
}

static void shift_block()
{
    if (s_block == nullptr) {
        return;
    }
    const int dx = static_cast<int>(esp_random() % 121) - 60;
    const int dy = static_cast<int>(esp_random() % 121) - 60;
    const int x = clamp_i(k_base_x + dx, 8, 1024 - k_block_w - 8);
    const int y = clamp_i(k_base_y + dy, 8, 600 - k_block_h - 8);
    lv_obj_set_pos(s_block, x, y);
    s_last_shift_us = esp_timer_get_time();
}

lv_obj_t* screen_idle_create()
{
    s_scr = lv_obj_create(nullptr);
    lv_obj_set_size(s_scr, 1024, 600);
    lv_obj_set_style_bg_color(s_scr, COL_BG, 0);
    lv_obj_set_style_bg_opa(s_scr, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(s_scr, 0, 0);
    lv_obj_set_style_pad_all(s_scr, 0, 0);
    lv_obj_remove_flag(s_scr, LV_OBJ_FLAG_SCROLLABLE);

    s_block = lv_obj_create(s_scr);
    lv_obj_set_size(s_block, k_block_w, k_block_h);
    lv_obj_set_pos(s_block, k_base_x, k_base_y);
    lv_obj_set_style_bg_opa(s_block, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(s_block, 0, 0);
    lv_obj_set_style_pad_all(s_block, 0, 0);
    lv_obj_remove_flag(s_block, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(s_block, LV_OBJ_FLAG_CLICKABLE);

    s_clock = ui_make_label(s_block, 0, 0, &lv_font_montserrat_48, COL_TEXT, "--:--");
    lv_obj_set_width(s_clock, k_block_w);
    lv_obj_set_style_text_align(s_clock, LV_TEXT_ALIGN_CENTER, 0);

    s_water = ui_make_label(s_block, 0, 90, &lv_font_montserrat_42, COL_TEXT, "-- C");
    lv_obj_set_width(s_water, k_block_w);
    lv_obj_set_style_text_align(s_water, LV_TEXT_ALIGN_CENTER, 0);

    s_water_meta = ui_make_label(s_block, 0, 150, &lv_font_montserrat_20, COL_MUTED, "");
    lv_obj_set_width(s_water_meta, k_block_w);
    lv_obj_set_style_text_align(s_water_meta, LV_TEXT_ALIGN_CENTER, 0);

    s_tasks = ui_make_label(s_block, 0, 210, &lv_font_montserrat_30, COL_TEXT, "-");
    lv_obj_set_width(s_tasks, k_block_w);
    lv_obj_set_style_text_align(s_tasks, LV_TEXT_ALIGN_CENTER, 0);

    s_last_shift_us = esp_timer_get_time();
    return s_scr;
}

void screen_idle_on_enter()
{
    shift_block();
}

void screen_idle_update(const AppState& st, const LiveSnapshot& live,
                        const StatusSnapshot& app)
{
    if (s_scr == nullptr) {
        return;
    }

    const int64_t now = esp_timer_get_time();
    if (now - s_last_shift_us >= static_cast<int64_t>(APP_SCREEN_IDLE_SHIFT_S) * 1000000LL) {
        shift_block();
    }

    if (st.time_synced) {
        time_t t = time(nullptr);
        struct tm tm_local = {};
        localtime_r(&t, &tm_local);
        lv_label_set_text_fmt(s_clock, "%02d:%02d", tm_local.tm_hour, tm_local.tm_min);
    } else {
        lv_label_set_text(s_clock, "--:--");
    }

    if (live.water_temp.present) {
        char num[24];
        ui_format_nl(num, sizeof(num), live.water_temp.value, 1);
        lv_label_set_text_fmt(s_water, "%s C", num);
        lv_obj_set_style_text_color(s_water, live.water_temp.stale ? COL_MUTED : COL_TEXT, 0);
        if (live.water_temp.stale) {
            int mins = live.water_temp.age_s / 60;
            if (mins < 1) {
                mins = 1;
            }
            lv_label_set_text_fmt(s_water_meta, "verouderd (%d min)", mins);
            lv_obj_set_style_text_color(s_water_meta, COL_ORANGE, 0);
        } else if (live.water_temp.from_database) {
            lv_label_set_text(s_water_meta, "laatst opgeslagen");
            lv_obj_set_style_text_color(s_water_meta, COL_MUTED, 0);
        } else {
            lv_label_set_text(s_water_meta, "");
        }
    } else {
        lv_label_set_text(s_water, "-- C");
        lv_obj_set_style_text_color(s_water, COL_MUTED, 0);
        lv_label_set_text(s_water_meta, "wacht op data");
        lv_obj_set_style_text_color(s_water_meta, COL_MUTED, 0);
    }

    if (!app.has_data) {
        lv_label_set_text(s_tasks, "-");
        lv_obj_set_style_text_color(s_tasks, COL_MUTED, 0);
    } else if (app.due_now_count <= 0) {
        lv_label_set_text(s_tasks, "Geen open taken");
        lv_obj_set_style_text_color(s_tasks, COL_MUTED, 0);
    } else if (app.due_now_count == 1) {
        lv_label_set_text(s_tasks, "1 open taak");
        lv_obj_set_style_text_color(s_tasks, COL_TEXT, 0);
    } else {
        lv_label_set_text_fmt(s_tasks, "%d open taken", app.due_now_count);
        lv_obj_set_style_text_color(s_tasks, COL_TEXT, 0);
    }
}
