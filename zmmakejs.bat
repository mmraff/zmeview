@echo off
:: zmmakejs.bat
:: This script attempts to gather information about the apparent
:: ZoneMinder event directories at a user-specified location,
:: then encodes that information in a JavaScript file, to be read
:: by a JavaScript application.
::
:: Author: Matthew Rafferty
:: Version: 1.0.2
:: Date: September 2014

setlocal EnableDelayedExpansion
set JSFILE=zmevents.js

:: The user must supply the location of the event dirs as an argument.
if "%1"=="" (
  echo You must give the path to the location of event directories!
  endlocal
  exit /b 1
)
:: Attempt to de-quote
set EVTROOT=%~1
:: If the given path is absolute but lacks the drive spec, or
:: if it is relative but goes up through the parent directory,
:: cut the crap and translate it to a fully-specified absolute:
if "%EVTROOT:~0,1%"=="\" (set EVTROOT=%~f1) else (
  if "%EVTROOT:~0,2%"==".." (set EVTROOT=%~f1))

:: if EVTROOT includes a drive spec, we have to treat it specially for the
:: "root" property in the JavaScript object. Also, need to replace all "\"
:: with "/".
set JSEVTROOT=%EVTROOT:\=/%
if "%JSEVTROOT:~1,1%"==":" (set "JSEVTROOT=file:///%JSEVTROOT%")

:: To cut down on the number of times we open-write-close the output file,
:: we will accumulate lines in a string as a buffer. We keep the "block size"
:: limited to avoid hitting the limit of variable content size.
set /a "_BLOCKSZ=40"

:: How to capture a newline in a variable
set NL=^


::  2 blank lines above are necessary; Do not delete!

set _dateSrc=%date%
set _TIMESTR=%time%
echo Started at %_TIMESTR%

:: Isolate hh:mm:ss from time - we don't need decimal fraction
set _temp=%_TIMESTR:*.=.%
call set _TIMESTR=%%_TIMESTR:%_temp%=%%
set _TSTAMP=%_TIMESTR%

:: Get & rearrange date components; while we're there,
:: convert numeric month to abbreviated name
set _monthmap=JanFebMarAprMayJunJulAugSepOctNovDec
for /f "tokens=1,2,3,4 delims=/ " %%G in ("%_dateSrc%") do (
  set _mn=%%H
  if "!_mn:~0,1!"=="0" (set /a "_mn=!_mn:~1!")
  set /a "_mn-=1,_mn*=3"
  call set _mo=%%_monthmap:~!!_mn!!,3%%
  set _TIMESTR=%%G, %%I !_mo! %%J %_TIMESTR%
  set _TSTAMP=%%J-%%H-%%IT%_TSTAMP%
)

:: Template of file header
echo(^
/*!NL!^
 * zmevents.js: Data for zmeview!NL!^
 * Updated: %_TIMESTR%!NL!^
 *!NL!^
 * THIS FILE IS AUTO-GENERATED - DO NOT EDIT^^!!NL!^
 */!NL!^
!NL!^
zmEvents.eventsSrc = {!NL!^
  timestamp: "%_TSTAMP%",!NL!^
  root: "%JSEVTROOT%",!NL!^
  list: [^
 >%JSFILE%
:: End of file header

:: If there are a lot of event dirs, the script could take a while.
:: Give the user a little feedback:
<NUL (set/p _temp=Working)

:: Get a count of the dirs with names that fit the ZM event Id pattern
for /f "usebackq" %%G in (
  `dir /b /a:d "%EVTROOT%" ^|findstr /n /r "^[1-9][0-9]*$" ^|find /c ":"`
) do (set _numdirs=%%G)

set /a "_tested=0"
set /a "_idx=0"
set "_re=^[1-9]"
:: Why not use "for /d" below? ...and what else is happening here:
:: The sequential numbering of ZM events is same as chronological order.
:: The default ordering of a dir listing (by name) is dictionary order, which
:: is generally not the same as numerical order. For example, the dictionary
:: ordering of a sequence from 1 to 10 is: 1, 10, 2, 3, 4, 5, 6, 7, 8, 9.
:: We need to ensure chronological order, so we work with sets of event Ids
:: of the same length, incrementing the length after exhausting each set.
:NEXTOOM
for /f "usebackq" %%G in (`dir /b /a:d "%EVTROOT%" ^|findstr /r "!_re!$"`) do (
  set _evtdir=%%G
  <NUL (set/p _temp=.)
  set _lastfrm=
  call :getlastframe

REM :: If we failed to find a last frame, there's something wrong with the
REM :: contents of this directory, so we should skip it.

  if defined _return (
    set _lastfrm=!_return!
    set "_item={ evtnum: ^"!_evtdir!^", lastframe: !_lastfrm! }"
    if defined _blk (set "_blk=!_blk!,!NL!    !_item!") ^
    else (set "_blk=    !_item!")
    set /a "_idx+=1"
    set /a "_modtest=!_idx!%%_BLOCKSZ%"
    if !_modtest! EQU 0 (
      if %_BLOCKSZ% LSS !_idx! (set "_blk=,!NL!!_blk!")
      <NUL (set/p _temp=!_blk!)>>%JSFILE%
      set _blk=
    )
  )
  set /a "_tested+=1"
)
:: Are all dirs accounted for?
if !_tested! LSS %_numdirs% (
REM :: It's time to select dirs with longer name (next order-of-magnitude)
  set "_re=!_re![0-9]"
  goto NEXTOOM
)

:: Handle any remaining lines (count < _BLOCKSZ)
if defined _blk (
  if %_BLOCKSZ% LSS !_idx! (set "_blk=,!NL!!_blk!")
  <NUL (set/p _temp=!_blk!)>>%JSFILE%
  set _blk=
)
if !_idx! EQU 0 (
  echo.
  echo WARNING: No valid event directories found at given path!
)
:: Close the list and finish the output file
echo(!NL!  ]!NL!};>>%JSFILE%
echo.
echo Finished at %time%
goto exit

:getlastframe
set _return=
setlocal
for /f "usebackq" %%H in (
  `dir /b "%EVTROOT%"\!_evtdir! ^|findstr /n /r "^0*[1-9][0-9]*-capture.jpg$" ^|find /c ":"`
) do (
REM :: Because of the tricky way we 'intuit' the last frame number above, we're
REM :: obliged to check whether the corresponding image file really exists
REM :: (consider case: 1 or more files could be missing from the directory...)
REM :: ZoneMinder convention is to name frames with numeric prefix of at minimum
REM :: three digits, which means pad with zero(s) if n < 100
  set _prefix=%%H
  if %%H LSS 10 (set _prefix=00%%H) ^
  else if %%H LSS 100 (set _prefix=0%%H) 
  if exist "%EVTROOT%"\!_evtdir!\!_prefix!-capture.jpg (
    endlocal & set _return=%%H
    goto :eof
  )
)
endlocal
goto :eof

:exit
endlocal

