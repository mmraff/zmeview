/*
  This file is part of the application
  zmeview: Viewer for image sequences captured by ZoneMinder
  Author: Matthew Rafferty
  Version: 1.0.3
  Date: September 2014
*/

var zmEvents = {}; // Namespace for this app

// Module
_debug = (function(){

  var
    DEBUGMODE = false,
    // Debug levels
    INFO = 0,
    WARN = 1,
    ERROR = 2,
    // Exportable functions
    debug_out;

  debug_out = function(msg, level) {
    if (! DEBUGMODE) { return; }
    if (! window.console) { return; }
    switch (level) {
      case INFO:
        console.info(msg);
        break;
      case WARN:
        console.warn(msg);
        break;
      case ERROR:
        console.error(msg);
        break;
      default:
        console.info(msg);
    }
  };

  return {
    INFO: INFO,
    WARN: WARN,
    ERROR: ERROR,
    out: debug_out
  };
}());

// Module
zmEvents.Viewer = (function(){

  var
    // MODULE 'CONSTANTS'
    TIMING = 1000/28, // (1000 ms)/(28 fps)
    ZEROES = "00000000000000000000",
    // DVR conditions that determine button states
    INITIAL = 0,
    MOVING = 1,
    PAUSED = 2,
    ENDED = 3,
    REWOUND = 4,
    
    // MODULE VARS
    currIndex,
    currEvent,
    minDigits,
    lastFrame,
    currFrame,
    currFilepath,   // Saved in case of error loading <img>
    currSpeed = 1,
    lastChange,     // The # of frames (and direction) of the last attempt to update the image
                    // (for use by error handler)
    intId, // setInterval Id, for use by clearInterval()
    tmId,  // setTimeout Id, """; needed by next_event() and prev_event() in some cases
    
    imgEl,
    evtnumEl,
    frmnumEl,
    speedvalEl,
    
    setevent_listeners = [],
    controls = {
      prevBtn: null,
      fastRevBtn: null,
      stepRevBtn: null,
      pauseBtn: null,
      playBtn: null,
      stepFwdBtn: null,
      fastFwdBtn: null,
      nextBtn: null
    },
    // PRIVATE FUNCTIONS
    TODO,
    abort_timers,
    swap_image,
    swap_image_1d,
    swap_image_2d,
    swap_image_md,
    set_button_states,
    change_button_states,
    handle_img_error,
    set_event,
    next_frame,
    prev_frame,
    jump_frames,
    play,
    fast_forward,
    fast_reverse,
    step_forward,
    step_reverse,
    pause,
    next_event,
    prev_event,
    // FUNCTIONS TO BE EXPORTED
    init,
    play_event,
    on_set_event;

  TODO = function() {
    _debug.out(
      "TODO: this is a placeholder for a function not yet implemented",
      _debug.INFO
    );
  };
  
  abort_timers = function() {
    if (intId) {
      clearInterval(intId);
      intId = 0;
    }
    if (tmId) {
      clearTimeout(tmId);
      tmId = 0;
    }
  };

  // Change the currently displayed image by modifying the src attribute of the img tag.
  // It's assumed that the caller of this function has just modified currFrame.
  // Version 1: for EVENT_IMAGE_DIGITS == 1
  swap_image_1d = function() {
    currFilepath = [
      zmEvents.eventsSrc.root, "/", currEvent, "/", currFrame, "-capture.jpg"
    ].join('');
    imgEl.src = currFilepath;
    frmnumEl.value = currFrame;
  };
  // Version 2: for EVENT_IMAGE_DIGITS == 2
  swap_image_2d = function() {
    var prefix = currFrame < 10 ? "0" : "";
    currFilepath = [
      zmEvents.eventsSrc.root, "/", currEvent, "/", prefix, currFrame, "-capture.jpg"
    ].join('');
    imgEl.src = currFilepath;
    frmnumEl.value = currFrame;
  };
  // Version 3: for EVENT_IMAGE_DIGITS > 2
  swap_image_md = function() {
    var digitStr = "" + currFrame,
        prefix = "";

    if (digitStr.length < minDigits) {
      prefix = ZEROES.substr(0, minDigits - digitStr.length);

      // Stress tests show that this alternative way takes a little longer,
      // though it's guaranteed to handle *any* minDigits value > 2:
      //prefix = (new Array(minDigits + 1 - digitStr.length)).join('0');
    }

    currFilepath = [
      zmEvents.eventsSrc.root, "/", currEvent, "/", prefix, digitStr, "-capture.jpg"
    ].join('');
    imgEl.src = currFilepath;
    frmnumEl.value = currFrame;
  };

  set_button_states = function(toState) {

    switch (toState) {
      case REWOUND:
        controls.fastRevBtn.disabled = true;
        controls.stepRevBtn.disabled = true;
        controls.pauseBtn.disabled = true;
        controls.playBtn.disabled = false;
        controls.stepFwdBtn.disabled = false;
        controls.fastFwdBtn.disabled = false;
        break;
      case ENDED:
        controls.fastRevBtn.disabled = false;
        controls.stepRevBtn.disabled = false;
        controls.pauseBtn.disabled = true;
        controls.playBtn.disabled = true;
        controls.stepFwdBtn.disabled = true;
        controls.fastFwdBtn.disabled = true;
        break;
      default:
        _debug.out(
          ["set_button_states: state ", toState, " is unimplemented"].join(''),
          _debug.ERROR
        );
    }
  };

  change_button_states = function(fromState, toState) {
    
    var errUnimplemented = function() {
      _debug.out([
        "change_button_states: ", fromState, " --> ", toState, " is unimplemented"
      ].join(''), _debug.ERROR);
    };

    // I'm on the fence over this approach...
    // It's motivated by the desire to keep the state change code centralized
    // with each set clearly labeled;
    // but is it worth the overhead? I guess it depends on how many sections
    // are reused...
    switch (fromState) {
      case REWOUND:
        switch (toState) {
          case MOVING:
          // (implies fwd motion):
            controls.fastRevBtn.disabled = false;
            controls.pauseBtn.disabled = false;
            controls.stepFwdBtn.disabled = true;
            //[if by play()] playBtn.disabled = true;
            break;
          case PAUSED: 
          // This applies only when the *first frame* is stepped
            controls.fastRevBtn.disabled = false;
            controls.stepRevBtn.disabled = false;
            break;
          default:
            errUnimplemented();
        }
        break;
      case MOVING:
        switch (toState) {
          case PAUSED:
            controls.stepRevBtn.disabled = false;
            controls.pauseBtn.disabled = true;
            controls.stepFwdBtn.disabled = false;
            // also, if currSpeed is 1x, need to enable the playBtn
            break;
          case ENDED:
            controls.stepRevBtn.disabled = false;
            controls.pauseBtn.disabled = true;
            controls.fastFwdBtn.disabled = true;
            // also, if currSpeed is *not* 1x, need to disable the playBtn
            break;
          case REWOUND:
            controls.fastRevBtn.disabled = true;
            controls.pauseBtn.disabled = true;
            controls.playBtn.disabled = false;
            controls.stepFwdBtn.disabled = false;
            break;
          default:
            errUnimplemented();
        }
        break;
      case PAUSED:
        switch (toState) {
          case MOVING:
            controls.stepRevBtn.disabled = true;
            controls.pauseBtn.disabled = false;
            controls.stepFwdBtn.disabled = true;
            // also, if play(), playBtn.disabled = true;
            break;
          case ENDED:
            controls.playBtn.disabled = true;
            controls.stepFwdBtn.disabled = true;
            controls.fastFwdBtn.disabled = true;
            break;
          case REWOUND:
            controls.fastRevBtn.disabled = true;
            controls.stepRevBtn.disabled = true;
            break;
          default:
            errUnimplemented();
        }
        break;
      case ENDED:
        switch (toState) {
          case MOVING:
            controls.stepRevBtn.disabled = true;
            controls.pauseBtn.disabled = false;
            controls.playBtn.disabled = false;
            controls.fastFwdBtn.disabled = false;
            break;
          case PAUSED:
          // This applies only when the *last frame* is stepped back
            controls.playBtn.disabled = false;
            controls.stepFwdBtn.disabled = false;
            controls.fastFwdBtn.disabled = false;
            break;
          default:
            errUnimplemented();
        }
        break;
      default:
        _debug.out([
          "change_button_states: state ", fromState, " is unimplemented"
        ].join(''), _debug.ERROR);
    }
  };

  // This is called by next_event(), prev_event(), and play_event()
  set_event = function(eventIdx, inReverse) {
    var zmEvt, i;
    if ("undefined" == typeof eventIdx) {
      _debug.out("set_event: no data given!", _debug.ERROR);
      return false;
    }
    if (eventIdx < 0 || zmEvents.eventsSrc.list.length <= eventIdx) {
      _debug.out("set_event: index " + eventIdx + " is out of bounds!", _debug.ERROR);
      return false;
    }
    lastChange = 0;
    zmEvt = zmEvents.eventsSrc.list[eventIdx];
    currIndex = eventIdx;
    currEvent = zmEvt.evtnum;
    minDigits = zmEvt.sigdigits;
    switch (minDigits) {
      case 1: swap_image = swap_image_1d; break;
      case 2: swap_image = swap_image_2d; break;
      default: swap_image = swap_image_md;
    }
    lastFrame = zmEvt.lastframe;
    currFrame = inReverse ? lastFrame : 1;
    evtnumEl.value = currEvent;
    set_button_states(inReverse ? ENDED : REWOUND);
    controls.prevBtn.disabled = (eventIdx == 0);
    controls.nextBtn.disabled = (eventIdx == zmEvents.eventsSrc.list.length - 1);
    swap_image();
    for (i = 0; i < setevent_listeners.length; i++) {
      setevent_listeners[i](eventIdx, inReverse);
    }
    return true;
  };

  handle_img_error = function(evt) {
    abort_timers();
    _debug.out( "Could not load image \"" + currFilepath, _debug.WARN );
    // Restore the previously displayed image, if any
    if (! lastChange) {
      _debug.out([
        "<img> error: event dir ", currEvent, " seems to be compromised"
        ].join(""), _debug.ERROR
      );
      return;
    }
    currFrame -= lastChange;
    if (currFrame < 1 || lastFrame < currFrame) {
      _debug.out(
        "<img> error: currFrame [" + currFrame + "] is out of bounds",
        _debug.ERROR
      );
    }
    else { swap_image(); }
  };

  next_frame = function() {
    var result = true;
    if (currFrame == lastFrame) {
      _debug.out("Attempt to advance past last frame!", _debug.WARN);
      return false;
    }
    currFrame++;
    lastChange = 1;
    swap_image();
    if (currFrame == lastFrame) {
      result = false;
    }
    return result;
  };

  prev_frame = function() {
    var result = true;
    if (0 == currFrame) {
      _debug.out("Attempt to backstep first frame!", _debug.WARN);
      return false;
    }
    currFrame--;
    lastChange = -1;
    swap_image();
    if (1 == currFrame) {
      result = false;
    }
    return result;
  };

  // Change to the image n frames forward (or back, if negative n)
  jump_frames = function(n) {
    var
      result = true,
      nActual = n;

    if (0 < n ) {
      if (currFrame == lastFrame) {
        _debug.out("Attempt to jump past last frame!", _debug.WARN);
        return false;
      }
      if (lastFrame < currFrame + n) {
        nActual = lastFrame - currFrame;
      }
    }
    else if (n < 0) {
      if (0 == currFrame) {
        _debug.out("Attempt to reverse jump from first frame!", _debug.WARN);
        return false;
      }
      if (currFrame + n < 1) {
        nActual = 1 - currFrame;
      }
    }
    else {
      _debug.out("jump_frames: arg is 0", _debug.ERROR);
      return false;
    }
    currFrame += nActual;
    lastChange = nActual;
    swap_image();
    if (1 == currFrame || currFrame == lastFrame) {
      result = false;
    }
    return result;
  };
  
  play = function() {
    var action;

    abort_timers();
    currSpeed = 1;
    speedvalEl.value = currSpeed;

    action = function() {
      if (! next_frame()) {
        // We've reached the state of ENDED by rate==1x (playBtn already disabled)
        clearInterval(intId);
        intId = 0;
        change_button_states(MOVING, ENDED);
      }
    };

    intId = setInterval(action, TIMING);
    change_button_states(currFrame == 1 ? REWOUND : PAUSED, MOVING);
    controls.playBtn.disabled = true;
  };

  step_forward = function() {
    if (currFrame == 1) {
      change_button_states(REWOUND, PAUSED);
    }
    if (! next_frame()) {
      change_button_states(PAUSED, ENDED);
    }
  };

  step_reverse = function() {
    if (currFrame == lastFrame) {
      change_button_states(ENDED, PAUSED);
    }
    if (! prev_frame()) {
      change_button_states(PAUSED, REWOUND);
    }
  };

  fast_forward = function() {
    var action, fromState;

    if (intId) {
      fromState = MOVING;
    }
    else if (currFrame == 1) {
      fromState = REWOUND;
    }
    else if (currFrame == lastFrame) {
      _debug.out("fast_forward: from end!? This should not happen.", _debug.ERROR);
      return;
    }
    else {
      fromState = PAUSED;
    }
    abort_timers();

    if (currSpeed < 0) {
      // User is switching direction, so go to nominal FFwd speed
      currSpeed = 2;
    }
    else if (fromState != PAUSED) {
      currSpeed *= 2; // might be more efficient to shift...
    }
    speedvalEl.value = currSpeed;

    action = function() {
      if (! jump_frames(currSpeed)) {
        clearInterval(intId);
        intId = 0;
        change_button_states(MOVING, ENDED);
        controls.playBtn.disabled = true;
      }
    };
    if (fromState != MOVING) {
      change_button_states(fromState, MOVING);
    }
    intId = setInterval(action, TIMING);
  };

  fast_reverse = function() {
    var action, fromState;

    if (intId) {
      fromState = MOVING;
    }
    else if (currFrame == 1) {
      _debug.out("fast_reverse: from start!? This should not happen.", _debug.ERROR);
      return;
    }
    else if (currFrame == lastFrame) {
      fromState = ENDED;
    }
    else {
      fromState = PAUSED;
    }
    abort_timers();

    if (0 < currSpeed) {
      // User is switching direction, so go to nominal FRev speed
      currSpeed = -1;
    }
    else if (fromState != PAUSED) {
      currSpeed *= 2; // might be more efficient to shift
    }
    speedvalEl.value = currSpeed;

    action = function() {
      if (! jump_frames(currSpeed)) {
        clearInterval(intId);
        intId = 0;
        change_button_states(MOVING, REWOUND);
      }
    };
    if (fromState != MOVING) {
      change_button_states(fromState, MOVING);
    }
    intId = setInterval(action, TIMING);
  };

  pause = function() {
    if (! intId) {
      _debug.out("Pause button accessed while nothing is running!", _debug.ERROR);
      return;
    }
    abort_timers();
    change_button_states(MOVING, PAUSED);
    if (currSpeed == 1) {
      controls.playBtn.disabled = false;
    }
  };

  next_event = function() {
    // NOTE: I decided not to do this the ZM way, which struck me as counterintuitive
    // (ZM way: if speed is currently negative, clicking the Next button will
    // take you in reverse through the *previous* event).
    // Therefore, if the current speed is positive, it's maintained through the
    // next event; if negative, we fall back to Play speed through the next event.

    if (zmEvents.eventsSrc.list.length - 1 <= currIndex) {
      _debug.out("next_event: from last event?! This should not happen.", _debug.ERROR);
      return;
    }

    abort_timers();
    set_event(currIndex + 1);
    if (1 < currSpeed) {
      tmId = setTimeout( 
        function(){
          tmId = 0; // Prevent a useless clearTimeout() call
          step_forward();
          fast_forward();
        },
        TIMING
      );
    }
    else {
      play();
    }
  };

  prev_event = function() {
    if (currIndex == 0) {
      _debug.out("prev_event: from first event?! This should not happen.", _debug.ERROR);
      return;
    }

    abort_timers();

    if (0 < currSpeed) {
      set_event(currIndex - 1);
      if (1 < currSpeed) {
        tmId = setTimeout(
          function(){
            tmId = 0; // Prevent a useless clearTimeout() call
            step_forward();
            fast_forward();
          },
          TIMING
        );
      }
      else {
        play();
      }
    }
    else if (currSpeed < 0) {
      set_event(currIndex - 1, true); // start at the end of previous event
      tmId = setTimeout( 
        function(){
          tmId = 0; // Prevent a useless clearTimeout() call
          step_reverse();
          fast_reverse();
        },
        TIMING
      );
    }
  };
  
  init = function() {
    var btnId;

    imgEl = document.getElementById("zmframe");
    currFilepath = imgEl.src;
    // As explanation of the following, this note from the jqapi documentation:
    // "... the error event may not be correctly fired when the page is served locally;
    //  error [jQuery function] relies on HTTP status codes and will generally not be
    //  triggered if the URL uses the file: protocol."
    // Therefore, we put jQuery aside here and go old school:
    if (imgEl.addEventListener) {
      imgEl.addEventListener("error", handle_img_error, false);
    }
    else if (imgEl.attachEvent) {
      imgEl.attachEvent("onerror", handle_img_error);
    }
    else {
      imgEl.onerror = handle_img_error;
    }

    // Handlers for the DVR controls
    for (btnId in controls) {
      controls[btnId] = document.getElementById(btnId);
      controls[btnId].disabled = true; // because page reload fails to do it
    }
    $(controls.prevBtn).click(prev_event);
    $(controls.fastRevBtn).click(fast_reverse);
    $(controls.stepRevBtn).click(step_reverse);
    $(controls.pauseBtn).click(pause);
    $(controls.playBtn).click(play);
    $(controls.stepFwdBtn).click(step_forward);
    $(controls.fastFwdBtn).click(fast_forward);
    $(controls.nextBtn).click(next_event);

    // Status display elements, below the controls
    evtnumEl = document.getElementById("eventnum");
    frmnumEl = document.getElementById("framenum");
    speedvalEl = document.getElementById("speedval");
    // Because page reload retains old values of form controls:
    evtnumEl.value = "";
    frmnumEl.value = "";
    speedvalEl.value = "";
  };
  
  play_event = function(evtIndex) {
    // TODO: might want to flesh this out somehow
    if (! set_event(evtIndex)) {
      alert("Can't play event at index " + evtIndex);
      return false;
    }
    play();
  };
  
  on_set_event = function(handler) {
    if ("function" != typeof handler) {
      _debug.out(
        "onSetevent: invalid argument; you must pass a function reference.",
        _debug.ERROR
      );
      return false;
    }
    setevent_listeners.push(handler);
  };

  return {
    init: init,
    playEvent: play_event,
    onSetevent: on_set_event
  };
}());

// Module
zmEvents.Zoomer = (function(){

  var
    myId,
    imgEl,
    prevZoom,
    listener,
    init,
    reapply;

  init = function(sliderElId, imageElId, chgFunc) {
    prevZoom = 1.0;
    myId = sliderElId;
    imgEl = document.getElementById(imageElId);
    if ('function' == typeof chgFunc) { listener = chgFunc; }

    // Add the Zoom slider, with a 'change' event handler
    $( "#" + sliderElId ).slider({
      min:   1.0,
      max:   3.0,
      step:  0.5,
      value: 1.0,
      change: function(event, ui) {
        var
          w = imgEl.width,
          h = imgEl.height,
          newZoom = ui.value,
          factor = (newZoom / prevZoom);

        imgEl.width = w * factor;
        imgEl.height = h * factor;
        prevZoom = newZoom;
        if (listener) { listener(); }
      }
    });
  };

  reapply = function() {
    var w, h;
    imgEl.width = "";
    imgEl.height = "";
    w = imgEl.width;
    h = imgEl.height;
    imgEl.width = w * prevZoom;
    imgEl.height = h * prevZoom;
    if (listener) { listener(); }
  };

  return {
    init: init,
    reapply: reapply
  };
}());

// Module
// dependency: Viewer
zmEvents.LinksMaker = (function(){

  var
    init;

  init = function(boxId) {
    var
      i,
      evtList,
      evtCount,
      evtRoot,
      datetime,
      df,
      tf,
      update,
      aList,
      $listBox = $("#" + boxId);

    try {
      evtList = zmEvents.eventsSrc.list;
    } catch (exc) {
      $listBox.html(
        "<h3>No event data available.</h3>" +
        "<p>Please see <code>README</code> file for usage instructions.</p>"
      );
      return;
    }
    evtCount = evtList.length;
    aList = new Array(evtCount);
    evtRoot = zmEvents.eventsSrc.root;
    if ("file:///" == evtRoot.substr(0,8)) {
      evtRoot = evtRoot.substr(8);
    }
    datetime = zmEvents.eventsSrc.timestamp.split('T');
    df = datetime[0].split('-');
    tf = datetime[1].split(':');
    update = new Date(df[0], df[1]-1, df[2], tf[0], tf[1], tf[2]);
    // TODO maybe: compare to current date-time, and display a warning
    // if it seems "too old"...
    $("#evtlisthead").html([
      'Location: <input type="text" readonly="readonly"><br>',
      '(list updated ', update.toLocaleDateString(), ' ', datetime[1], ')'
    ].join(''))
      .find("input[type='text']")
      .val(evtRoot);

    for (i = 0; i < evtCount; i++) {
      aList[i] = $([
          '<a href="javascript:;">', evtList[i].evtnum, '</a>'
        ].join(''))
        .click({index: i}, function(event) {
          zmEvents.Viewer.playEvent(event.data.index);
        }).get(0);
        // This *seems* to go a little quicker than the way of jQuery().each().
    }
    $(aList).appendTo($listBox);
  };

  return {
    init: init
  };
}());

$(document).ready(function(){
try {
  zmEvents.manageHeight = function() {
    $("#vboxgrp").height( $("#viewerbox").outerHeight(true) );
  };
  zmEvents.Viewer.onSetevent(zmEvents.Zoomer.reapply);
  zmEvents.Viewer.init();
  zmEvents.manageHeight();
  zmEvents.Zoomer.init( "zoomCtrl", "zmframe", zmEvents.manageHeight );
  zmEvents.LinksMaker.init("evtlistbox");
  document.getElementById("zmframe").style.backgroundImage = "none";
} catch (exc) { _debug.out(exc); }
});

