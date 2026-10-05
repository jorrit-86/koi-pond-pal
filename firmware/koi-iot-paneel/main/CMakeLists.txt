idf_component_register(
    SRCS
        "main.cpp"
        "core/app_state.cpp"
        "core/panel_id.cpp"
        "core/net_manager.cpp"
        "core/time_sync.cpp"
        "core/settings_store.cpp"
        "core/screen_manager.cpp"
        "data/diag_store.cpp"
        "data/live_store.cpp"
        "data/status_store.cpp"
        "data/vent_store.cpp"
        "data/param_catalog.cpp"
        "data/measurement_queue.cpp"
        "io/mqtt_link.cpp"
        "io/backend_client.cpp"
        "io/ha_client.cpp"
        "io/ota_client.cpp"
        "ui/ui_root.cpp"
        "ui/ui_chrome.cpp"
        "ui/ui_numpad.cpp"
        "ui/screen_dashboard.cpp"
        "ui/screen_measure.cpp"
        "ui/screen_entry.cpp"
        "ui/screen_history.cpp"
        "ui/screen_tasks.cpp"
        "ui/screen_idle.cpp"
        "ui/screen_settings.cpp"
    INCLUDE_DIRS "."
    REQUIRES
        nvs_flash esp_wifi esp_netif esp_event esp_timer esp_system esp_hw_support
        esp_app_format lwip spi_flash mqtt json esp_http_client esp-tls mbedtls
        app_update esp_https_ota
        bsp_i2c bsp_display bsp_wifi
)

# Eigen code: waarschuwingen serieus nemen (Elecrow-code blijft ongemoeid, W4)
target_compile_options(${COMPONENT_LIB} PRIVATE
    $<$<COMPILE_LANGUAGE:CXX>:-Wall -Wextra>
)

# LVGL 9.1: afgeronde fill malloc't een mask_buf; bij intern-heap-vol is die NULL
# en crasht lv_memset(dst=0). Eén guard in managed_components (Elecrow-BSP ongewijzigd).
# Framebuffers staan al in PSRAM (bsp_display: buff_spiram=true).
set(_koi_lv_fill "${CMAKE_SOURCE_DIR}/managed_components/lvgl__lvgl/src/draw/sw/lv_draw_sw_fill.c")
if(EXISTS "${_koi_lv_fill}")
    file(READ "${_koi_lv_fill}" _koi_lv_fill_src)
    if(NOT _koi_lv_fill_src MATCHES "koiot_null_mask")
        string(REPLACE
            "void lv_draw_sw_fill(lv_draw_unit_t * draw_unit, const lv_draw_fill_dsc_t * dsc, const lv_area_t * coords)\n{\n    if(dsc->opa <= LV_OPA_MIN) return;"
            "void lv_draw_sw_fill(lv_draw_unit_t * draw_unit, const lv_draw_fill_dsc_t * dsc, const lv_area_t * coords)\n{\n    if(dsc->opa <= LV_OPA_MIN) return;\n    if(draw_unit == NULL || draw_unit->target_layer == NULL || draw_unit->target_layer->draw_buf == NULL || draw_unit->target_layer->draw_buf->data == NULL) { /* koiot_null_dest */ LV_LOG_ERROR(\"lv_draw_sw_fill: dest buf NULL; fill overgeslagen\"); return; }"
            _koi_lv_fill_src "${_koi_lv_fill_src}")
        string(REPLACE
            "        mask_buf = lv_malloc(clipped_w);\n        lv_draw_sw_mask_radius_init"
            "        mask_buf = lv_malloc(clipped_w);\n        if(mask_buf == NULL) { /* koiot_null_mask */ LV_LOG_ERROR(\"lv_draw_sw_fill: mask_buf NULL len=%d; fill overgeslagen\", (int)clipped_w); return; }\n        lv_draw_sw_mask_radius_init"
            _koi_lv_fill_src "${_koi_lv_fill_src}")
        file(WRITE "${_koi_lv_fill}" "${_koi_lv_fill_src}")
        message(STATUS "KOIoT: lv_draw_sw_fill NULL-buffer guard toegepast")
    endif()
endif()
