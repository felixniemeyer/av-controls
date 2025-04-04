# AV-Controls
AV-Controls makes it easy to create a web UI in a dedicated tab for sending control signals to your web app. 


## usage

Install with `npm install av-controls`. 

Then, 
- create a couple of control receivers (`Controls.<control type>.Receiver`)
- and a window receiver that will listen to messages from another tab or the parent window in case this runs in an iframe. 

```ts
// import controls and transports from av-controls
import {
  Controls, 
  Transports
} from 'av-controls'

// create one root control (a group), that contains other controls
const controlsGroup = new Controls.Group.Receiver(
  new Controls.Group.SpecWithoutControls(
    new Controls.Base.Args( // every controller takes a base arg as the first constructor argument
      'leaves', // label 
      0, // x position within the parent
      0, // y position 
      100, // width
      100, // height, gaps are added automatically
      '#000000' // control color
    ),
  ), 
  { // a dictionary of child controls in this group
    'leafScale': new Controls.Fader.Receiver(
      new Controls.Fader.Spec(
        new Controls.Base.Args(
          'leafScale',
          0,
          0,
          10,
          50,
          '#039f21'
        ), 
        1, // initial value
        0.3,  // min value
        3, // max value
        2 // displayed decimal places
      ), 
      // some controllers take optional callbacks 
      (value) => {
        this.setLeafScale(value);
      }
    ), 
    'timeScale': this.timeScaleFader,
    'clear Background': new Controls.Pad.Receiver(
      new Controls.Pad.Spec(
        new Controls.Base.Args(
          'clear Background',
          90,
          0,
          10,
          10,
          '#922123'
        ),
      ),
      () => {
        this.darkenFrameBuffer(1);
      }
    )
  }
));

// create the controls receiver
const controlsWindow = window.opener || window.parent
new Transports.Window.Receiver(controlsWindow, 'leaves', controlsGroup)
```

## AV-Controller
You can then use it with the av-controller. 
E.g. you can open it on avonx.com like this: 

[https://avonx.space/single-controller/?control=http://localhost:5174](https://avonx.space/single-controller/?control=http://localhost:5174)

where the second localhost url with port 5174 should point to your artwork. 

## WebSocket support
Besides the window transport that is very fast and works with `postMessage`, there is also a websocket implementation. 

