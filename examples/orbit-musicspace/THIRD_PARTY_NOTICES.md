# Attribution

## Faust Orbit UI

Yann Orlarey's `faust-orbit-ui`, version 0.4.1, MIT license.
Source: https://github.com/orlarey/faust-orbit-ui
Pinned revision: `9286c0739702b0959e3d8d951d14faf008eae191`.
The original license is included at `vendor/orbit/LICENSE`.
Local integration changes are recorded in `vendor/orbit/musicspace.patch`.

## MusicSpace

François Pachet's MusicSpace, standalone engine 0.1.0-alpha.5, MIT license.
Source: https://github.com/fpachet/musicspace
License: `vendor/MusicSpace-LICENSE`.

## Faust compiler and libraries

The included DSP was compiled with GRAME's Faust 2.81.2.
Source: https://github.com/grame-cncm/faust
Libraries: https://github.com/grame-cncm/faustlibraries

The compiled metadata (`audio/orbit-study.json`) preserves the individual library
author and license declarations, including GRAME and Julius O. Smith III.
GRAME's Faust library license has an explicit exception allowing the generated
compiled DSP to be distributed under the author's chosen license. The local DSP
source is MIT licensed. The oscillators and resonant filter include work by Julius
O. Smith III, declared under the MIT-style STK-4.3 license in Faust's metadata.

The AudioWorklet wrapper in this demo is an independent minimal implementation for
the generated module, not a copy of a Faust architecture file.
