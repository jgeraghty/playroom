import './styles/app.css';
import './styles/arcade.css';
import { games } from './catalog/games.js';
import * as progressStore from './shell/progress-store.js';
import { createApp } from './shell/app.js';

const root = document.querySelector('#app');
if (root) createApp({ root, games, progressStore });
