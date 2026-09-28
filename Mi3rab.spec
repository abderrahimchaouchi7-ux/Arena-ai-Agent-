# -*- mode: python ; coding: utf-8 -*-
"""وصفة PyInstaller لإنتاج Mi3rab.exe مستقل على Windows."""

from PyInstaller.utils.hooks import collect_all

webview_datas, webview_binaries, webview_hiddenimports = collect_all("webview")

a = Analysis(
    ["main.py"],
    pathex=[],
    binaries=webview_binaries,
    datas=[
        ("web", "web"),
        ("models", "models"),
    ] + webview_datas,
    hiddenimports=webview_hiddenimports + ["clr_loader"],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "numpy", "pandas"],
    noarchive=False,
    optimize=1,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="Mi3rab",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=["assets/mi3rab.ico"],
    version="version_info.txt",
)
