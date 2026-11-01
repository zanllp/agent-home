import {defineConfig} from 'vite';
export default defineConfig({build:{rollupOptions:{input:{home:'index.html',wander:'wander.html'}}},server:{proxy:{'/api':'http://127.0.0.1:19130','/models':'http://127.0.0.1:19130'}}});
