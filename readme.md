# AV-Controls

Use the ReceiverBuilder to easily specify a touch controller UI that runs in a separate tab. 

# Get started

This provides a sender and a receiver class for tabs to send control signals for audio and visual stuff. 

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
