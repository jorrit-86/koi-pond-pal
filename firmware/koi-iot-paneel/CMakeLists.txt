# KOIoT Paneel - ESP-IDF project (ESP32-P4, Elecrow CrowPanel Advanced 10.1" V1.2)
# Gebaseerd op de projectopzet van Elecrow Lesson16 (V1.2).
cmake_minimum_required(VERSION 3.16)

# App-descriptor (esp_app_desc.version / OTA-header). Gelijk houden aan APP_FW_VERSION.
# Moet vóór include(project.cmake)/project() staan. project() = APP_OTA_PROJECT_NAME.
set(PROJECT_VER "0.3.0-m3f")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)

# Alleen componenten bouwen die (transitief) door main vereist worden - zoals bij Elecrow.
idf_build_set_property(MINIMAL_BUILD ON)
set(EXTRA_COMPONENT_DIRS "components")

project(koi_iot_paneel)
