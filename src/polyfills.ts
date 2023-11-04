/***************************************************************************************************
 * Zone JS is required by default for Angular itself.
 */
import 'zone.js'; // Included with Angular CLI.

/***************************************************************************************************
 * APPLICATION IMPORTS
 */

import 'zone.js';

import * as process from 'process';
import { Buffer } from 'buffer';

window.process = process;
(window as any).global = window;
global.Buffer = global.Buffer || Buffer;
