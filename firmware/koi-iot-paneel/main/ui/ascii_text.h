// KOIoT Paneel - UTF-8 naar ASCII voor LVGL Montserrat (geen Latin-1 tot eigen fonts).
#pragma once

#include <cstddef>
#include <cstdint>
#include <cstring>

// Kopieert src naar dst en vervangt veelvoorkomende UTF-8 (ë, é, en-dash, ×, …)
// door ASCII. Onbekende multibyte-tekens worden overgeslagen.
inline void ascii_from_utf8(char* dst, size_t dst_len, const char* src)
{
    if (dst == nullptr || dst_len == 0) {
        return;
    }
    dst[0] = '\0';
    if (src == nullptr) {
        return;
    }
    size_t o = 0;
    const unsigned char* p = reinterpret_cast<const unsigned char*>(src);
    while (*p != 0 && o + 1 < dst_len) {
        if (*p < 0x80) {
            const unsigned char c = *p++;
            dst[o++] = (c < 32 || c == 127) ? ' ' : static_cast<char>(c);
            continue;
        }
        // 2-byte UTF-8
        if ((p[0] & 0xE0) == 0xC0 && p[1] != 0) {
            const unsigned int u = ((p[0] & 0x1F) << 6) | (p[1] & 0x3F);
            p += 2;
            char repl = 0;
            switch (u) {
                case 0xC0: case 0xC1: case 0xC2: case 0xC3: case 0xC4: case 0xC5:
                case 0xE0: case 0xE1: case 0xE2: case 0xE3: case 0xE4: case 0xE5:
                    repl = (u < 0xE0) ? 'A' : 'a';
                    break;
                case 0xC7: repl = 'C'; break;
                case 0xE7: repl = 'c'; break;
                case 0xC8: case 0xC9: case 0xCA: case 0xCB:
                    repl = 'E';
                    break;
                case 0xE8: case 0xE9: case 0xEA: case 0xEB:
                    repl = 'e';
                    break;
                case 0xCC: case 0xCD: case 0xCE: case 0xCF:
                    repl = 'I';
                    break;
                case 0xEC: case 0xED: case 0xEE: case 0xEF:
                    repl = 'i';
                    break;
                case 0xD1: repl = 'N'; break;
                case 0xF1: repl = 'n'; break;
                case 0xD2: case 0xD3: case 0xD4: case 0xD5: case 0xD6:
                    repl = 'O';
                    break;
                case 0xF2: case 0xF3: case 0xF4: case 0xF5: case 0xF6:
                    repl = 'o';
                    break;
                case 0xD9: case 0xDA: case 0xDB: case 0xDC:
                    repl = 'U';
                    break;
                case 0xF9: case 0xFA: case 0xFB: case 0xFC:
                    repl = 'u';
                    break;
                case 0xDD: repl = 'Y'; break;
                case 0xFD: case 0xFF: repl = 'y'; break;
                case 0xD7: repl = 'x'; break;
                case 0xF7: repl = '/'; break;
                case 0xB0: repl = ' '; break;  // graad
                case 0xB5: repl = 'u'; break;  // micro
                case 0xA0: repl = ' '; break;
                default:
                    repl = 0;
                    break;
            }
            if (repl != 0) {
                dst[o++] = repl;
            }
            continue;
        }
        // 3-byte: en-dash / em-dash / dots / quotes
        if ((p[0] & 0xF0) == 0xE0 && p[1] != 0 && p[2] != 0) {
            const unsigned int u = ((p[0] & 0x0F) << 12) | ((p[1] & 0x3F) << 6) | (p[2] & 0x3F);
            p += 3;
            if (u == 0x2013 || u == 0x2014 || u == 0x2212) {
                dst[o++] = '-';
            } else if (u == 0x2026) {
                if (o + 3 < dst_len) {
                    dst[o++] = '.';
                    dst[o++] = '.';
                    dst[o++] = '.';
                }
            } else if (u == 0x2018 || u == 0x2019) {
                dst[o++] = '\'';
            } else if (u == 0x201C || u == 0x201D) {
                dst[o++] = '"';
            } else if (u == 0x00D7) {
                dst[o++] = 'x';
            }
            continue;
        }
        // 4-byte of incompleet: overslaan
        if ((p[0] & 0xF8) == 0xF0) {
            p += (p[1] && p[2] && p[3]) ? 4 : 1;
            continue;
        }
        p++;
    }
    dst[o] = '\0';
}
