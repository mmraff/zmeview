zmeview
=======

Offline browser-based viewer for ZoneMinder image file sets.

This project allows the user to view "events" recorded from video input by
ZoneMinder (the video surveillance package for Linux) through a web browser.
This is *not* a client for ZoneMinder: the event images do not need to be on
the same filesystem where they were recorded; in fact no network connection
is necessary.

The controls of the interface include Play, Pause, Fast Forward, Fast Reverse,
Step Forward (single frame), Step Back, Next Event, and Previous Event. There
is also a discrete-stepped slider control to change the size of the viewport.
To the right of the viewport and controls is a list of available event items,
each of which can be clicked to play.

Discuss at http://darksideofthedualboot.blogspot.com/2014/09/project-z.html

##Usage
These instructions assume that you're working from the command line on the
target computer.

1. Unpack the project archive to a convenient location.

2. If necessary, change the permissions on the 'zmmakejs' script that applies
to your operating system so that it is executable.

3. Decide where the ZoneMinder event image directories will be stored, and
ensure that they get there.
  * Do not change the names of the event directories or the names of the
    image files, because the ZoneMinder numeric naming convention determines
    the sequence of events, and of the frames in an event.
  * For a similar reason, do not mix the event directories from different
    servers, else the correct sequence of events may become unclear.
  * Locating the event directories on removeable media is not recommended
    (I have seen very poor performance of the viewer through Firefox on
    Windows XP when the images are being read from a USB drive, even though
    the viewer runs well on Linux/Iceweasel reading from the same USB drive
    on the same computer!)

4. Change into the base directory of the project.

5. Run the 'zmmakejs' script for your operating system, giving the path to
the location set in step 3 as the only argument. Use:
  - zmmakejs.bat for the traditional command line in Windows
  - zmmakejs.sh for the bash shell in Unix or Linux

  The script will be busy for a while, depending on the amount of events to
  process, but it will tell you when it's "Finished."

6. Verify that there is a new file called "zmevents.js" in the current
directory. (Note: any previous file by that name will be overwritten!)

7. Load the file "zmeview.html" into your web browser.  To start viewing,
click on one of the numeric event IDs in the list pane on the right.

8. If the set of event directories gets updated, repeat steps 4 through 7.

##Motivation
ZoneMinder is an excellent software-based video surveillance solution for
those on a limited budget. The web-based control panel of that application
provides a full-featured interface to review recorded events in (supported)
browsers that can connect to the server machine - including the simplest case,
a browser on the desktop of the server machine.  Means are also provided to
generate video files of various popular formats from the image sequences, so
that motion events can be shared with parties that don't have access to the
server where the source images are stored.

Unfortunately, there's no way to adjust the image quality of the output (in
the version on my server, v1.24.2), and the quality of the exported video file
tends to be significantly worse than the quality of the still images.
When your video source resolution is as low as 320 x 240 pixels, security
requirements may not allow you to sacrifice any more quality.

Those who have used ZoneMinder, and wanted to share the output with someone
who can't get an HTTP connection to their server, may have been frustrated
with the limited options available to communicate their event data.
This project is a web browser-based application that *does not* rely on a
ZoneMinder server, nor conversion to video.

ZoneMinder records a sequence of captured images, representing a video "event",
in a directory named by the numeric ID of the event.  Additional information
about the event is stored in a database on the server.  In particular, the
database holds the frame rate at the time each still image (frame) is recorded.
This project, however, is not concerned with any database data, only the image
files; therefore it can work with image files transferred to a location off of
the ZoneMinder server.

The code in this project needs no compiling. It uses scripts that can be
read easily by human eyes, and it takes advantage of the graphical features
made available by the web browser (with a little help from the jQuery toolkit
and jQueryUI). No minification/obfuscation was also a deliberate choice.
The human-readable format was a very important constraint in this project:
especially if those with whom you want to share surveillance events are law
enforcement personnel, they are totally justified in being suspicious of
anyone who would tell them "Just install this special application on your
computer, it's OK." Scripts are easier to vet than mysterious compiled
executable files.
