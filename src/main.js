import './styles.css';
import { appTitle } from './core/version.js';
import { start } from './app/loop.js';
document.title = appTitle();
start();
