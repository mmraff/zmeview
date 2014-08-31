#!/bin/bash
#
# zmmakejs.sh
# This script attempts to gather information about the apparent
# ZoneMinder event directories at a user-specified location,
# then to encode that information in a JavaScript file, to be
# read by a JavaScript application.
#
# Note that bash is invoked, and not sh:
# 'shopt' and 'extglob' are features specific to bash that
# are needed for this script.
#
# Author: Matthew Rafferty
# Version: 1.0
# Date: August 2014

# The output file:
JSFILE="$PWD/zmevents.js"

# The user must supply the location of the event dirs as the argument.
if [ -z "$1" ]
then
  echo "You must give the path to the location of event directories!"
  exit 1
fi
EVTROOT=$1
if [ "$EVTROOT" != "." ] && [ "$EVTROOT" != "./" ] && [ "$EVTROOT" != "$PWD" ]
then cd $EVTROOT
fi

echo -n "Started at "; date +%T

# The human-readable version of the time this was run
# (output mostly the same as PowerShell "{0:R}" -f <DateTime object>)
TIMESTR=`date -R`
# A more easily parseable timestamp of the time this was run
# (exact same result as PowerShell "{0:s}" -f <DateTime object>)
TSTAMP=`date --date="$TIMESTR" +%FT%T`

# Template file header
filehdr="$( cat - <<EOS
/*
 * zmevents.js: Data for zmeview
 * Updated: ${TIMESTR}
 *
 * THIS FILE IS AUTO-GENERATED - DO NOT EDIT!
 */

zmEvents.eventsSrc = {
  timestamp: "${TSTAMP}",
  root: "${EVTROOT}",
  list: [
EOS
)"

# If there are a lot of event dirs, the script could take a while.
# Give the user a little feedback:
echo -n "Working"

# The extglob (bash) shell option gives highly-desirable regex-like
# functionality, so we can filter the entries more tightly than
# without it.
# This var will let us remember if we had to enable it, so we can
# know to turn it off again later.
TURN_EXTGLOB_OFF=0
if ! shopt extglob 1>/dev/null
then
  shopt -s extglob
  TURN_EXTGLOB_OFF=1
fi

evtlist=()
declare -i idx=0
# The following assumes that nobody changed the event directory names, and they
# are left as strictly numeric
for evtdir in `ls -d [1-9]+([0-9]) |sort -n -`; do
  echo -n "."
  # $evtdir is the entry currently being examined.
  # If it's not a directory, then skip it:
  if [ ! -d $evtdir ]; then continue; fi
  # If we get here, $evtdir is probably an event directory.
  # Go into it, and isolate the last frame number from the last JPG filename:
  cd $evtdir
  frameNum=`ls *(0)[1-9]*([0-9])-capture.jpg |sort -n - |tail -1 - |grep -o "[1-9][0-9]*" -`
  if [ -n "$frameNum" ]
  then
    evtlist[$idx]="{ evtnum: \"$evtdir\", lastframe: $frameNum }"
    idx+=1
  fi
  cd - > /dev/null
done
if [ $TURN_EXTGLOB_OFF -eq 1 ]; then shopt -u extglob; fi

if [ $idx -eq 0 ]
then
  echo; echo "No valid event directories found at given path!"
  exit 2
fi

# Wrangle the array items
if [ $idx -gt 1 ]
then
  allBut1st="$( printf ",\n    %s" "${evtlist[@]:1}" )"
fi

printf "%s\n    %s%s\n  ]\n};" "$filehdr" "${evtlist[0]}" "$allBut1st" > $JSFILE
echo; echo -n "Finished at "; date +%T

