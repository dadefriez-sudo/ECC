const { createApp } = await import('../../src/app.js');
createApp().listen(4100, () => console.log('BACKEND READY on 4100'));
