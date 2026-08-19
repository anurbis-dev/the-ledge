import './styles.css';
import { appTitle } from './core/version.js';
import { start } from './app/loop.js';

function releaseBootGate(){
	var body = document.body;
	if (!body) return;
	var tries = 0;
	var maxTries = 180;

	function tick(){
		tries++;
		var view = document.getElementById('view');
		var styled = false;
		if (view){
			var cs = getComputedStyle(view);
			styled = cs.position === 'relative' && cs.overflow === 'hidden';
		}
		if (styled || tries >= maxTries){
			body.removeAttribute('data-boot');
			return;
		}
		requestAnimationFrame(tick);
	}

	requestAnimationFrame(tick);
}

document.title = appTitle();
start();
releaseBootGate();
