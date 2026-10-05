// KOIoT Paneel - param_catalog (brief §8 startwaarden).
#include "data/param_catalog.h"

#include <cstring>

// Waarschuwingsbereik: pal-app parameter-config als start (B6). Paneel rekent
// geen advies; alleen extra bevestiging bij tikfouten (§7.2).
static const ParamDef k_params[k_param_count] = {
    {"kh", "KH",
     {"dH", "mg/l CaCO3"}, 2,
     {0.f, 0.f}, {30.f, 535.f}, {0.1f, 1.f},
     {3.f, 53.f}, {12.f, 214.f}, {true, true}, {1, 0},
     14, 2},
    {"gh", "GH",
     {"dH", "mg/l CaCO3"}, 2,
     {0.f, 0.f}, {40.f, 715.f}, {0.1f, 1.f},
     {4.f, 71.f}, {20.f, 357.f}, {true, true}, {1, 0},
     14, 2},
    {"tan", "Ammoniak/TAN",
     {"mg/l NH3-N", "mg/l NH4"}, 2,
     {0.f, 0.f}, {10.f, 10.f}, {0.01f, 0.01f},
     {0.f, 0.f}, {0.50f, 0.50f}, {true, true}, {2, 2},
     7, 2},
    {"nitriet", "Nitriet",
     {"mg/l NO2", "ppb NO2-N"}, 2,
     {0.f, 0.f}, {5.f, 1000.f}, {0.01f, 1.f},
     {0.f, 0.f}, {0.30f, 90.f}, {true, true}, {2, 0},
     7, 2},
    {"nitraat", "Nitraat",
     {"mg/l NO3", nullptr}, 1,
     {0.f, 0.f}, {200.f, 0.f}, {1.f, 0.f},
     {0.f, 0.f}, {50.f, 0.f}, {true, false}, {0, 0},
     14, 2},
    {"fosfaat", "Fosfaat",
     {"mg/l PO4", "ppb P"}, 2,
     {0.f, 0.f}, {10.f, 2000.f}, {0.01f, 1.f},
     {0.f, 0.f}, {1.0f, 200.f}, {true, true}, {2, 0},
     14, 2},
    {"ph", "pH (handmatig)",
     {"pH", nullptr}, 1,
     {4.f, 0.f}, {10.f, 0.f}, {0.1f, 0.f},
     {6.5f, 0.f}, {8.5f, 0.f}, {true, false}, {1, 0},
     7, 2},
    {"zout", "Zout",
     {"%", nullptr}, 1,
     {0.f, 0.f}, {1.0f, 0.f}, {0.01f, 0.f},
     {0.f, 0.f}, {0.f, 0.f}, {false, false}, {2, 0},
     0, 0},
};

const ParamDef* param_catalog_get(int idx)
{
    if (idx < 0 || idx >= k_param_count) {
        return nullptr;
    }
    return &k_params[idx];
}

int param_catalog_count()
{
    return k_param_count;
}

int param_catalog_index_of(const char* key)
{
    if (key == nullptr || key[0] == '\0') {
        return -1;
    }
    for (int i = 0; i < k_param_count; i++) {
        if (strcmp(k_params[i].key, key) == 0) {
            return i;
        }
    }
    return -1;
}

Freshness param_freshness(int idx, int64_t measured_at_unix, int64_t now_unix,
                          int32_t* days_left_out)
{
    if (days_left_out != nullptr) {
        *days_left_out = -1;
    }
    const ParamDef* p = param_catalog_get(idx);
    if (p == nullptr) {
        return Freshness::Unknown;
    }
    if (p->shelf_days <= 0) {
        return Freshness::None;
    }
    if (measured_at_unix < 1700000000 || now_unix < 1700000000) {
        return Freshness::Unknown;
    }
    const int64_t age = now_unix - measured_at_unix;
    const int64_t shelf_s = static_cast<int64_t>(p->shelf_days) * 86400LL;
    const int64_t left = shelf_s - age;
    const int32_t days_left = static_cast<int32_t>(left / 86400LL);
    if (days_left_out != nullptr) {
        *days_left_out = days_left;
    }
    if (left <= 0) {
        return Freshness::Expired;
    }
    if (p->warn_days_left > 0 && days_left <= p->warn_days_left) {
        return Freshness::Soon;
    }
    return Freshness::Fresh;
}
