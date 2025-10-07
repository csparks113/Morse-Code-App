@echo off
set "VCINSTALLDIR=C:\Program Files\Microsoft Visual Studio\18\Insiders\VC\"
set "VSINSTALLDIR=C:\Program Files\Microsoft Visual Studio\18\Insiders\"
set "DIA_SDK_DIR=C:\Program Files\Microsoft Visual Studio\18\Insiders\DIA SDK"
set "PATH=C:\Program Files\Microsoft Visual Studio\18\Insiders\VC\Tools\MSVC\14.50.35503\bin\Hostx64\x64;%PATH%"
cd /d C:\dev\Morse
npx expo run:android --device SM_S906U --variant debug
