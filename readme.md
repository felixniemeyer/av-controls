# AV-Controls
AV-Controls makes it easy to create a web UI in a dedicated tab for sending control signals to your web app. 

Use the ReceiverBuilder from this package to easily specify a touch controller UI that runs in a separate tab. 

```ts
// import the controls and meters you'd like to use
import { 
	Fader,
	FaderSpec,
} from 'av-controls';

// create a controls dictionary
const controls: ControlsDict = {
  <control-id>: new Fader(
    new FaderSpec(
      '<fader label>', 
      20, 0,        // x, y
      10, 50,       // width, height
      '#e35',       // color
      80,           // initial value
      60, 140,      // min max
      2             // displayed decimal places 
    ), 
    (value: number) => { 
      // on fader value change, do something...
    }
  ), 
  // ... add more controls
}

// create the receiver. 
// this will announce the controls spec to the opener tab
const receiver = new Receiver(
  '<app name>', 
  controls, 
  '<info text>'
)

```

## AV-Controller
The controller UI will run in a different tab. 
Open you web app from [AV-Controller](https://github.com/felixniemeyer/av-controller/). 

## Positioning in percent of parent
Values for positions and sizes are in unit percent of the container space. 

## You can group controls
There is one control type called `Group`. 
You can use it e.g. to visually group a set of controls. 

```
const visualControls: ControlsDict = {
  ...
}

const controls: ControlsDict = {
  <controls-id>: new Group(
    new GroupSpecWithoutControls( 
      'visual', 
      60, 0, 
      20, 100, 
      '#440'
    ), 
    visualControls // pass a dict of controls
  )
}
```
... where visualControls is a `ControlsDict` itself. 

## There are various controls
Look into `./src/control-specs.ts` to see which controls are available. 

As of writing this, these here are: 
```
class GroupSpecWithoutControls
class GroupSpec
class FaderSpec
class PadSpec
class SwitchSpec
class SelectorSpec
class ConfirmButtonSpec
class LabelSpec
class ConfirmSwitchSpec
class CakeSpec
```

