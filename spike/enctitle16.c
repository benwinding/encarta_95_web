#include <windows.h>

typedef BOOL (FAR PASCAL *GETTITLEPROC)(LPSTR);

static HINSTANCE api;
static GETTITLEPROC get_title;
static int comm = -1;
static char FAR buf[512];
static char FAR last[512];
static DWORD last_launch;
static DWORD last_emit;

static void write_out(const char FAR *s)
{
    if (comm >= 0) {
        WriteComm(comm, s, lstrlen(s));
    }
}

static void poll(void)
{
    HWND main;
    int i;
    DWORD now = GetTickCount();

    if (!api) {
        api = LoadLibrary("ENCARAPI.DLL");
        if (api) {
            get_title = (GETTITLEPROC)GetProcAddress(api, "FGETCURTOPICTITLE");
        }
    }

    main = FindWindow("EncartaMain", NULL);
    if (!main) {
        if (now - last_launch > 5000) {
            WinExec("D:\\ENCARTA\\ENCART95.EXE", SW_SHOW);
            last_launch = now;
        }
        return;
    }

    if (!get_title) {
        return;
    }

    buf[0] = '\0';
    if (!get_title(buf) || !buf[0]) {
        return;
    }

    for (i = 0; buf[i]; i++) {
        if (buf[i] == '\r' || buf[i] == '\n') {
            buf[i] = ' ';
        }
    }

    if (lstrcmp(buf, last) == 0 && now - last_emit < 2000) {
        return;
    }
    lstrcpy(last, buf);
    last_emit = now;

    if (comm < 0) {
        comm = OpenComm("COM1", 4096, 4096);
    }
    write_out("T");
    write_out(buf);
    write_out("\r\n");
}

int PASCAL WinMain(HINSTANCE inst, HINSTANCE prev, LPSTR cmd, int show)
{
    MSG msg;

    inst = inst;
    prev = prev;
    cmd = cmd;
    show = show;

    SetTimer(NULL, 1, 500, NULL);
    while (GetMessage(&msg, NULL, 0, 0)) {
        if (msg.message == WM_TIMER) {
            poll();
        }
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    return 0;
}
