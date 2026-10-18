#include <windows.h>

static HANDLE outh = INVALID_HANDLE_VALUE;
static char last[256] = {0};
static DWORD last_emit = 0;

static void out(const char *s) { DWORD w; if (outh != INVALID_HANDLE_VALUE) WriteFile(outh, s, lstrlenA(s), &w, 0); }

/* Encarta's current-article title is the caption of an Enc95Bar child window,
   stored as "p|<title>" (the Pinpointer/subcatbar caption). */
static char found[256];
static int have;

BOOL CALLBACK scan(HWND h, LPARAM l) {
    char cls[64], cap[512];
    GetClassNameA(h, cls, 64);
    GetWindowTextA(h, cap, 512);
    if (cap[0] == 'p' && cap[1] == '|' && cap[2]) {
        lstrcpynA(found, cap + 2, sizeof found);
        have = 1;
    }
    return 1;
}

int WINAPI WinMain(HINSTANCE a, HINSTANCE b, LPSTR c, int d) {
    outh = CreateFileA("COM1", GENERIC_WRITE, 0, NULL, OPEN_EXISTING, 0, NULL);
    if (outh == INVALID_HANDLE_VALUE)
        outh = CreateFileA("COM1", GENERIC_READ | GENERIC_WRITE, 0, NULL, OPEN_EXISTING, 0, NULL);
    out("===ENCTITLE START===\r\n");

    SetCurrentDirectoryA("D:\\ENCARTA");
    for (;;) {
        HWND m = FindWindowA("EncartaMain", NULL);
        if (!m) {
            if (last[0]) { last[0] = 0; out("T\n"); } /* Encarta gone */
            WinExec("D:\\ENCARTA\\ENCART95.EXE", SW_SHOW);
            Sleep(3000);
            continue;
        }
        have = 0; found[0] = 0;
        EnumChildWindows(m, scan, 0);
        if (have) {
            DWORD now = GetTickCount();
            /* emit on change, and re-emit periodically so a restored
               snapshot (which never sees a "change") still reports it */
            if (lstrcmpA(found, last) != 0 || (now - last_emit) > 2000) {
                lstrcpynA(last, found, sizeof last);
                last_emit = now;
                char buf[600];
                wsprintfA(buf, "T%s\r\n", found);
                out(buf);
            }
        }
        Sleep(500);
    }
    return 0;
}
