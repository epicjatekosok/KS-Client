// KS Client application-specific NVIDIA frame-rate policy, Windows x64.
#include <windows.h>
#include <cstdio>
#include <cwchar>
#include <cstring>
#include <cstdlib>
#include "nvapi.h"
#include "NvApiDriverSettings.h"

static NvAPI_UnicodeString profileName{};
static NvAPI_UnicodeString applicationName{};
static int failure(const char* step, NvAPI_Status status) {
    std::fprintf(stderr, "%s (NVAPI %d)\n", step, static_cast<int>(status));
    return 1;
}

struct Session {
    NvDRSSessionHandle handle = nullptr;
    ~Session() { if (handle) NvAPI_DRS_DestroySession(handle); }
};

static int policy(int fps, bool query) {
    Session session;
    auto status = NvAPI_DRS_CreateSession(&session.handle);
    if (status != NVAPI_OK) return failure("Create driver session", status);
    status = NvAPI_DRS_LoadSettings(session.handle);
    if (status != NVAPI_OK) return failure("Load driver profiles", status);
    NvDRSProfileHandle profile = nullptr;
    status = NvAPI_DRS_FindProfileByName(session.handle, profileName, &profile);
    if (status == NVAPI_PROFILE_NOT_FOUND) {
        if (query || fps == 0) { std::puts("0"); return 0; }
        NVDRS_PROFILE info{};
        info.version = NVDRS_PROFILE_VER;
        memcpy(info.profileName, profileName, sizeof(profileName));
        status = NvAPI_DRS_CreateProfile(session.handle, &info, &profile);
        if (status != NVAPI_OK) return failure("Create KS profile", status);
        NVDRS_APPLICATION app{};
        app.version = NVDRS_APPLICATION_VER;
        memcpy(app.appName, applicationName, sizeof(applicationName));
        status = NvAPI_DRS_CreateApplication(session.handle, profile, &app);
        if (status != NVAPI_OK) return failure("Register dedicated KS executable", status);
    } else if (status != NVAPI_OK) return failure("Find KS profile", status);

    NVDRS_PROFILE info{};
    info.version = NVDRS_PROFILE_VER;
    status = NvAPI_DRS_GetProfileInfo(session.handle, profile, &info);
    if (status != NVAPI_OK) return failure("Check profile ownership", status);
    if (info.isPredefined || info.numOfApps != 1) return failure("Profile is shared or predefined", NVAPI_ERROR);
    NVDRS_APPLICATION owner{};
    owner.version = NVDRS_APPLICATION_VER;
    status = NvAPI_DRS_GetApplicationInfo(session.handle, profile, applicationName, &owner);
    if (status != NVAPI_OK) return failure("Check dedicated KS executable", status);

    NVDRS_SETTING setting{};
    setting.version = NVDRS_SETTING_VER;
    status = NvAPI_DRS_GetSetting(session.handle, profile, FRL_FPS_ID, &setting);
    if (status != NVAPI_OK && status != NVAPI_SETTING_NOT_FOUND)
        return failure("Read driver frame limit", status);
    bool local = status == NVAPI_OK && setting.settingLocation == NVDRS_CURRENT_PROFILE_LOCATION;
    if (query) { std::printf("%u\n", local ? setting.u32CurrentValue : 0u); return 0; }
    if (!fps && !local) return 0;
    if (!fps) {
        status = NvAPI_DRS_RestoreProfileDefaultSetting(session.handle, profile, FRL_FPS_ID);
    } else {
        setting = {};
        setting.version = NVDRS_SETTING_VER;
        setting.settingId = FRL_FPS_ID;
        setting.settingType = NVDRS_DWORD_TYPE;
        setting.u32CurrentValue = static_cast<NvU32>(fps);
        status = NvAPI_DRS_SetSetting(session.handle, profile, &setting);
    }
    if (status != NVAPI_OK) return failure("Change KS frame limit", status);
    status = NvAPI_DRS_SaveSettings(session.handle);
    return status == NVAPI_OK ? 0 : failure("Save KS frame limit", status);
}

int wmain(int argc, wchar_t** argv) {
    const wchar_t name[] = L"KS Client - dedicated game runtime";
    const wchar_t exe[] = L"KSClientGame.exe";
    memcpy(profileName, name, sizeof(name));
    memcpy(applicationName, exe, sizeof(exe));
    if (argc != 2) return 2;
    const bool query = wcscmp(argv[1], L"read") == 0;
    wchar_t* end = nullptr;
    long fps = query ? 0 : wcstol(argv[1], &end, 10);
    if (!query && (!*argv[1] || *end || fps < 0 || fps > 1023 || (fps && fps < 20))) return 2;
    // The loader stub resolves NVIDIA's installed driver. No elevation or global settings.
    SetDllDirectoryW(L"");
    auto status = NvAPI_Initialize();
    if (status != NVAPI_OK) return failure("NVIDIA driver unavailable", status);
    int result = policy(static_cast<int>(fps), query);
    NvAPI_Unload();
    return result;
}
