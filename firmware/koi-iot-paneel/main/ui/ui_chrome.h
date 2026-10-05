// KOIoT Paneel - gedeelde UI-kleuren en chrome (statusbalk + navigatie).
#pragma once

#include "lvgl.h"

struct AppState;
struct StatusSnapshot;

struct UiStatusBar {
    lv_obj_t* clock = nullptr;
    lv_obj_t* date = nullptr;
    lv_obj_t* wifi = nullptr;
    lv_obj_t* mqtt = nullptr;
    lv_obj_t* backend = nullptr;
};

struct UiNav {
    lv_obj_t* bar = nullptr;
    lv_obj_t* badge = nullptr;
};

lv_obj_t* ui_make_bar(lv_obj_t* parent, int y, int h);
lv_obj_t* ui_make_card(lv_obj_t* parent, int x, int y, int w, int h);
lv_obj_t* ui_make_label(lv_obj_t* parent, int x, int y, const lv_font_t* font,
                        lv_color_t color, const char* text);

UiStatusBar ui_status_bar_create(lv_obj_t* parent);
void ui_status_bar_update(const UiStatusBar& bar, const AppState& st, const StatusSnapshot& app);

// active: 0 Overzicht, 1 Taken, 2 Meting invoeren, 3 Historie, 4 Instellingen
UiNav ui_nav_create(lv_obj_t* parent, int active);
void ui_nav_set_badge(UiNav& nav, int count);  // badge Taken: due vandaag of overdue

void ui_format_nl(char* out, size_t out_len, double v, int decimals);
