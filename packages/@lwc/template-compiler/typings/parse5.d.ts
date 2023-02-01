/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import 'parse5';
import { Token } from 'parse5';

declare module 'parse5' {
    export interface ParsingError extends Token.Location {
        code: string;
    }
}
