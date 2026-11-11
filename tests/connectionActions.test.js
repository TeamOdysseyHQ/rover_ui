import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { get } from 'svelte/store';
import { apiStatus, disconnectFromRover, testConnection } from '../src/lib/stores/apiStore.js';
import { rosStatus } from '../src/lib/stores/rosStore.js';
import { connectRover } from '../src/lib/services/connectionActions.js';

const target = 'http://rover.test:6767';
const health = () => Response.json({ success: true, status: 'ok' });
const rosHealth = connected => Response.json({ success: true, status: { connected, url: 'ws://localhost:9090' } });

beforeEach(() => {
    disconnectFromRover();
    rosStatus.set({ status: 'disconnected', url: null, subscribedTopics: [], publishedTopics: [], lastChecked: null });
});

test('one connect action connects the API first, then ROS, and verifies both', async t => {
    const calls = [];
    let rosConnected = false;
    t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
        calls.push([url, options.method || 'GET']);
        if (url.endsWith('/api/status')) return health();
        if (url.endsWith('/api/ros/connect')) {
            assert.equal(get(apiStatus), 'connected');
            rosConnected = true;
            return Response.json({ success: true });
        }
        return rosHealth(rosConnected);
    });
    assert.equal(await connectRover(` ${target}/// `), true);
    assert.deepEqual(calls, [
        [`${target}/api/status`, 'GET'],
        [`${target}/api/ros/status`, 'GET'],
        [`${target}/api/ros/connect`, 'POST'],
        [`${target}/api/ros/status`, 'GET']
    ]);
    assert.equal(get(rosStatus).status, 'connected');
});

test('failed API connection never attempts a ROS connection', async t => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async url => {
        calls.push(url);
        return new Response('', { status: 503 });
    });
    assert.equal(await connectRover(target), false);
    assert.deepEqual(calls, [`${target}/api/status`]);
    assert.equal(get(apiStatus), 'error');
});

test('an already connected API and ROS bridge require no reconnect requests', async t => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async url => {
        calls.push(url);
        return url.endsWith('/api/status') ? health() : rosHealth(true);
    });
    await testConnection(target);
    calls.length = 0;
    assert.equal(await connectRover(target), true);
    assert.deepEqual(calls, [`${target}/api/ros/status`]);
});

test('a successful connect response cannot hide a disconnected ROS bridge', async t => {
    t.mock.method(globalThis, 'fetch', async url => {
        if (url.endsWith('/api/status')) return health();
        if (url.endsWith('/api/ros/connect')) return Response.json({ success: true });
        return rosHealth(false);
    });
    assert.equal(await connectRover(target), false);
    assert.equal(get(apiStatus), 'connected');
    assert.equal(get(rosStatus).status, 'disconnected');
});

test('changing the selected API verifies the new host before checking ROS', async t => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async url => {
        calls.push(url);
        return url.endsWith('/api/status') ? health() : rosHealth(true);
    });
    await testConnection('http://previous.test:6767');
    calls.length = 0;
    assert.equal(await connectRover(target), true);
    assert.deepEqual(calls, [`${target}/api/status`, `${target}/api/ros/status`]);
});
