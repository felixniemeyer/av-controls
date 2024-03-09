# AV-Controls
AV-Controls makes it easy to create a web UI in a dedicated tab for sending control signals to your web app. 

Use the ReceiverBuilder from this package to easily specify a touch controller UI that runs in a separate tab. 

```ts
// import the controls and meters you'd like to use
import { 
	Fader,
	FaderSpec,
} from 'av-controls';

// create a recever builder
const receiverBuilder = new ReceiverBuilder('my-app-name')

// define
const spec = new FaderSpec(
  'fader name', 
  20, 0,        // x, y
  10, 50,       // width, height
  '#e35',       // color
  80,           // initial value
  60, 140,      // min max
  2             // displayed decimal places 
)
this.bpmFader = new Fader(spec, (value: number) => {
  ... // do something with value
})
receiverBuilder.addControl(this.bpmFader)

// create the receiver. 
// this will announce the controls spec to the opener tab
const receiver = receiverBuilder.build()
```

## AV-Controller
The controller UI will run in a different tab. 
Open you web app from [AV-Controller](https://github.com/felixniemeyer/av-controller/). 

