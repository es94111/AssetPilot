// tests/setup/register.mjs — 供 `node --import tests/setup/register.mjs <test file>` 使用
import { register } from 'node:module';

register('./resolve-hooks.mjs', import.meta.url);
