import { test, expect } from '@playwright/test';

test.use({ channel: 'msedge', reducedMotion: 'reduce' });

async function gameState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('cp_db_v1')).games.at(-1).state);
}

async function openGame(page, className, maxBots = false) {
  await page.locator(`button.${className}`).first().click();
  if (maxBots && await page.locator('.bot-count button').count()) await page.locator('.bot-count button').last().click();
  await page.locator('.mode-go').click();
  await page.locator('.game-host').waitFor();
}

async function signIn(page) {
  await page.addInitScript(() => localStorage.setItem('cp_intro_day', new Date().toISOString().slice(0, 10)));
  await page.goto('http://127.0.0.1:5174');
  await page.locator('.age-confirm').click();
  await page.getByRole('button', { name: 'Play as guest', exact: true }).click();
  await page.getByRole('button', { name: 'Later', exact: true }).click();
  await page.getByRole('button', { name: 'Games', exact: true }).click();
}

for (const size of [{width:390,height:700}, {width:360,height:640}, {width:1280,height:800}]) {
  test(`all game controls fit ${size.width}x${size.height}`, async ({page}, testInfo) => {
    test.setTimeout(180000);
    await page.setViewportSize(size);
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await signIn(page);
    const games = await page.evaluate(async () => (await import('/src/games/registry.ts')).ONLINE_GAMES.map(g => ({id:g.id, className:g.className})));
    for (const game of games) {
      await page.locator(`button.game-card.${game.className.trim().split(/\s+/).join('.')}`).first().click();
      await page.locator('.mode-go').click();
      await page.locator(`.game-table--${game.id}`).waitFor();
      const splash = page.locator('.clip-splash');
      if (await splash.count()) await splash.click();
      const measure = await page.locator('.game-body--board').evaluate(body => {
        const b = body.getBoundingClientRect();
        const items = [...body.querySelectorAll('.board-actions, .pool-controls, .poker-actions, .cb-hand, .rummy-hand, .my-hand, .chess-board, .ludo-board, .snakes-board')].filter(e=>e.getBoundingClientRect().height>0);
        return { body: {h:body.clientHeight, sh:body.scrollHeight, w:body.clientWidth, sw:body.scrollWidth}, items:items.map(e => { const r=e.getBoundingClientRect();return {class:e.className,top:r.top,bottom:r.bottom,left:r.left,right:r.right,inside:r.top>=b.top-1 && r.bottom<=b.bottom+1 && r.left>=b.left-1 && r.right<=b.right+1}; }) };
      });
      await page.screenshot({path:testInfo.outputPath(`${game.id}.png`)});
      expect.soft(measure.body.sh, `${game.id} vertical overflow ${JSON.stringify(measure)}`).toBeLessThanOrEqual(measure.body.h+2);
      expect.soft(measure.body.sw, `${game.id} horizontal overflow`).toBeLessThanOrEqual(measure.body.w+2);
      for (const item of measure.items) expect.soft(item.inside, `${game.id}: ${JSON.stringify(item)}`).toBe(true);
      await page.getByRole('button',{name:'Close game',exact:true}).click();
    }
    expect(errors).toEqual([]);
  });
}

test('real moves, visible draw result, rematch and no duplicate rewards', async ({page}) => {
  await page.setViewportSize({width:390,height:700});
  await signIn(page);
  await page.locator('button.game-card--ludo').first().click();
  await page.locator('.mode-go').click();
  await page.getByRole('button',{name:'Roll the dice',exact:true}).click();
  await expect(page.locator('.die')).toHaveAttribute('aria-label', /Die showing/);
  await page.getByRole('button',{name:'Close game',exact:true}).click();
  await page.locator('button.game-card--chess').first().click();
  await page.locator('.mode-go').click();
  await expect(page.locator('.chess-board')).toBeVisible();
  await page.getByRole('button', {name:'e2 white pawn',exact:true}).click();
  await page.getByRole('button', {name:'e4',exact:true}).click();
  await expect(page.getByRole('button', {name:'e4 white pawn',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close game',exact:true}).click();
  await page.locator('button.game-card--ttt').first().click();
  await page.locator('.mode-go').click();
  await page.locator('.game-table--tictactoe').waitFor();
  await page.evaluate(async () => {
    const storeUrl = performance.getEntriesByType('resource').map(e => e.name).find(url => url.includes('/src/backend/store.ts'));
    const {api,getDB} = await import(storeUrl);
    const g = getDB().games.at(-1);
    api.updateGame(g.id, s=>{ s.status='finished';s.winner='draw'; });
  });
  await expect(page.getByRole('dialog',{name:'Match result',exact:true})).toBeVisible();
  await expect(page.getByText("IT'S A DRAW",{exact:true})).toBeVisible();
  const rect = await page.getByRole('button',{name:'Rematch',exact:true}).boundingBox();
  expect(rect.y+rect.height).toBeLessThan(700);
  await expect(page.locator('.reward-xp')).toHaveText(/\+\d+ XP/);
  const ledger = await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name).find(u => u.includes('/src/backend/store.ts'));
    const {api,getDB,getSessionId} = await import(url);
    const id = getSessionId();
    const game = getDB().games.at(-1);
    const before = JSON.stringify(getDB().users[id]);
    await api.recordGame(id, game.id);
    await api.recordGame(id, game.id);
    return {before, after:JSON.stringify(getDB().users[id]), receipt:getDB().users[id].gameReceipts[game.id]};
  });
  expect(ledger.after).toBe(ledger.before);
  expect(ledger.receipt.outcome).toBe('draw');
  expect(ledger.receipt.couple).toBeUndefined();
  await page.getByRole('button',{name:'View final board',exact:true}).click();
  await page.getByRole('button',{name:'Show result',exact:true}).click();
  await page.getByRole('button',{name:'Rematch',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Match result',exact:true})).toHaveCount(0);
});

test('card hands, bidding, draw/discard, pool aiming and reactions work on mobile', async ({page}) => {
  const errors = [];
  page.on('pageerror',error=>errors.push(error.message));
  test.setTimeout(90000);
  await page.setViewportSize({width:360,height:640});
  await signIn(page);
  await openGame(page, 'game-card--callbreak');
  await expect(page.locator('.cb-hand .hand-card')).toHaveCount(13);
  await expect(page.locator('.cb-hand .hand-card').last()).toBeVisible();
  await page.getByRole('group', {name:'Your bid',exact:true}).getByRole('button', {name:'1',exact:true}).click();
  await expect.poll(async () => (await gameState(page)).phase).toBe('play');
  await page.locator('.cb-hand .hand-card.is-playable').first().click();
  await expect(page.locator('.cb-hand .hand-card')).toHaveCount(12);
  await page.getByRole('button',{name:'Close game',exact:true}).click();
  await openGame(page, 'game-card--rummy');
  await page.getByRole('button', {name:'Draw from the deck',exact:true}).click();
  await expect(page.locator('.rummy-hand .hand-card')).toHaveCount(14);
  await page.locator('.rummy-hand .hand-card').first().click();
  await page.getByRole('button', {name:'Discard',exact:true}).click();
  await expect(page.locator('.rummy-hand .hand-card')).toHaveCount(13);
  await page.getByRole('button',{name:'Close game',exact:true}).click();
  await openGame(page, 'game-card--pool');
  await page.evaluate(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => raf(time => callback(time - 25));
  });
  await page.locator('.pool-canvas').click({position:{x:240,y:90}});
  await page.getByRole('button', {name:'Shoot',exact:true}).click();
  await expect(page.locator('.pool-game')).toHaveAttribute('aria-busy','true');
  await expect.poll(() => page.locator('.pool-game').getAttribute('aria-busy'), {timeout:6000,intervals:[50]}).toBe('false');
  await page.getByRole('button', {name:'Send a reaction',exact:true}).click();
  await page.getByRole('group', {name:'Quick reactions'}).getByRole('button',{name:'Nice move!',exact:true}).click();
  await expect(page.locator('.reaction-pop')).toHaveText('Nice move!');
  expect(errors).toEqual([]);
});

test('full multiplayer tables fit narrow screens after dealing', async ({page}, testInfo) => {
  test.setTimeout(90000);
  await page.setViewportSize({width:360,height:640});
  await signIn(page);
  for (const name of ['poker','rummy','cards','ludo','snakes']) {
    await openGame(page, `game-card--${name}`, true);
    if (await page.locator('.clip-splash').count()) await page.locator('.clip-splash').click();
    await page.screenshot({path:testInfo.outputPath(`${name}-full.png`)});
    const body = await page.locator('.game-body--board').evaluate(e=>({h:e.clientHeight,sh:e.scrollHeight,w:e.clientWidth,sw:e.scrollWidth}));
    expect.soft(body.sh,`${name} vertical ${JSON.stringify(body)}`).toBeLessThanOrEqual(body.h+2);
    expect.soft(body.sw,`${name} horizontal ${JSON.stringify(body)}`).toBeLessThanOrEqual(body.w+2);
    await page.getByRole('button',{name:'Close game',exact:true}).click();
  }
});

test('solo completion creates a new run on rematch and retains the best score', async ({page}) => {
  await page.setViewportSize({width:360,height:640});
  await signIn(page);
  await openGame(page, 'game-card--bounce');
  const firstId = await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name).find(u => u.includes('/src/backend/store.ts'));
    const {api,getDB,getSessionId} = await import(url);
    const {bounceGame} = await import('/src/games/bounce.tsx');
    const g = getDB().games.at(-1);
    api.updateGame(g.id, s => {
      s.state = bounceGame.apply(s.state, {type:'over',score:125}, getSessionId());
      s.winner = bounceGame.winner(s.state);
      s.status = 'finished';
    });
    return g.id;
  });
  await expect(page.getByText('RUN COMPLETE',{exact:true})).toBeVisible();
  await expect(page.locator('.reward-xp')).toHaveText(/\+\d+ XP/);
  await page.getByRole('button',{name:'Rematch',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start',exact:true})).toBeVisible();
  const next = await page.evaluate(() => JSON.parse(localStorage.getItem('cp_db_v1')).games.at(-1));
  expect(next.id).not.toBe(firstId);
  expect(next.state.best).toBe(125);
  expect(next.state.lastScore).toBeNull();
  await page.getByRole('button',{name:'Start',exact:true}).click();
  await expect(page.locator('.bounce-overlay')).toHaveCount(0);
});

test('mood filters and the daily challenge update after a rewarded completion', async ({page}) => {
  await page.setViewportSize({width:390,height:700});
  await signIn(page);
  await page.getByRole('button',{name:'Chill',exact:true}).click();
  await expect(page.locator('button.game-card--rummy')).toBeVisible();
  await expect(page.locator('button.game-card--chess')).toHaveCount(0);
  await page.getByRole('button',{name:'Competitive',exact:true}).click();
  await expect(page.locator('button.game-card--chess')).toBeVisible();
  await expect(page.locator('button.game-card--snakes')).toHaveCount(0);
  await page.getByRole('button',{name:'All games',exact:true}).click();
  await expect(page.locator('.game-grid').first().locator('button')).toHaveCount(14);
  await page.getByRole('button',{name:'Take the challenge',exact:true}).click();
  await page.locator('.mode-go').click();
  await page.locator('.game-host').waitFor();
  if (await page.locator('.clip-splash').count()) await page.locator('.clip-splash').click();
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name).find(u => u.includes('/src/backend/store.ts'));
    const {api,getDB,getSessionId} = await import(url);
    const g = getDB().games.at(-1);
    api.updateGame(g.id, s=> {s.winner=getSessionId();s.status='finished';});
  });
  await expect(page.locator('.dare-badge')).toHaveText('Daily challenge complete · 1-day streak');
  await page.getByRole('button',{name:'Close game',exact:true}).click();
  await expect(page.getByRole('region',{name:'Daily challenge'})).toContainText('Challenge complete');
  await expect(page.getByRole('button',{name:'Play again',exact:true})).toBeVisible();
});

test('local writes retain updates that arrive before their storage notification', async ({page}) => {
  await signIn(page);
  const result = await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name).find(u => u.includes('/src/backend/store.ts'));
    const {api,getDB,getSessionId} = await import(url);
    const id = getSessionId();
    const before = getDB().users[id].hearts;
    const newer = JSON.parse(localStorage.getItem('cp_db_v1'));
    newer.users[id].hearts += 30;
    localStorage.setItem('cp_db_v1',JSON.stringify(newer));
    api.heartbeat(id);
    return {before,after:JSON.parse(localStorage.getItem('cp_db_v1')).users[id].hearts};
  });
  expect(result.after).toBe(result.before+30);
});

test('two human partners play, receive reactions and share one couple result', async ({page,context},testInfo) => {
  test.setTimeout(60000);
  await page.setViewportSize({width:360,height:640});
  await signIn(page);
  const partnerId = await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name).find(u => u.includes('/src/backend/store.ts'));
    const {mutate,getSessionId} = await import(url);
    const me = getSessionId(), partner = 'test-partner';
    mutate(db => {
      const today = new Date().toISOString().slice(0,10);
      db.users[me].displayName = 'Player One';
      db.users[me].partnerId = partner;
      db.users[me].rewardDay = today;
      db.users[partner] = {...db.users[me],id:partner,username:'partner',displayName:'Player Two',partnerId:me};
      db.friendships.push({id:'test-friendship',a:me,b:partner,createdAt:Date.now()});
    });
    return partner;
  });
  await page.locator('button.game-card--c4').first().click();
  await page.getByRole('button',{name:/With a friend/}).click();
  await page.locator('.friend-pick button').filter({hasText:'Player Two'}).click();
  await page.locator('.c4-board').waitFor();
  const partner = await context.newPage();
  await partner.setViewportSize({width:360,height:640});
  await partner.addInitScript(id=>sessionStorage.setItem('cp_session',id), partnerId);
  await partner.goto('http://127.0.0.1:5174');
  await partner.getByRole('navigation',{name:'Primary'}).getByRole('button',{name:/Chats$/}).click();
  await partner.locator('.chat-row').filter({hasText:'Player One'}).click();
  await partner.locator('.invite-card').getByRole('button',{name:'Play',exact:true}).click();
  await partner.locator('.c4-board').waitFor();
  await page.getByRole('button',{name:'Send a reaction',exact:true}).click();
  await page.getByRole('group',{name:'Quick reactions'}).getByRole('button',{name:'Nice move!',exact:true}).click();
  await expect(partner.locator('.speech-bubble').filter({hasText:'Nice move!'})).toBeVisible();
  for (let turn=0;turn<4;turn++) {
    await page.getByRole('button',{name:'Column 1',exact:true}).first().click();
    if (turn<3) await partner.getByRole('button',{name:'Column 2',exact:true}).first().click();
  }
  await expect(page.locator('.reward-couple')).toHaveText('+40 Couple XP');
  await partner.bringToFront();
  await expect(partner.locator('.reward-couple')).toHaveText('+40 Couple XP');
  await expect(page.getByText('YOU WON!',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close game',exact:true}).click();
  await page.getByRole('button',{name:'Me',exact:true}).click();
  const stats = page.getByRole('region',{name:'Couple stats',exact:true});
  await expect(stats).toContainText('40 Couple XP');
  await expect(stats).toContainText('Head to head: you 1');
  await expect(stats.locator('.couple-stats-grid strong').first()).toHaveText('1');
  await stats.getByText('Recent games together',{exact:true}).click();
  await expect(stats.locator('.match-highlights ol li')).toHaveCount(3);
  await page.screenshot({path:testInfo.outputPath('couple-profile.png')});
});

test('chess draw claims finish and pool results wait until the final shot settles', async ({page}) => {
  await page.setViewportSize({width:360,height:640});
  await signIn(page);
  await openGame(page,'game-card--chess');
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name).find(u => u.includes('/src/backend/store.ts'));
    const {api,getDB} = await import(url);
    const {chessGame} = await import('/src/games/chess.tsx');
    const g = getDB().games.at(-1);
    let state = g.state;
    for(let cycle=0;cycle<2;cycle++) for(const [from,to] of [[62,45],[6,21],[45,62],[21,6]]) {
      state = chessGame.apply(state,{type:'move',from,to},chessGame.currentPlayer(state));
    }
    api.updateGame(g.id,s=>{s.state=state;});
  });
  await page.getByRole('button',{name:'Claim draw (threefold repetition)',exact:true}).click();
  await expect(page.getByText("IT'S A DRAW",{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close game',exact:true}).click();
  await openGame(page,'game-card--pool');
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name).find(u => u.includes('/src/backend/store.ts'));
    const {api,getDB} = await import(url);
    const g = getDB().games.at(-1);
    api.updateGame(g.id,s=>{
      s.state.balls=[{id:0,x:100,y:50,potted:false},{id:8,x:100,y:8,potted:false}];
      s.state.groups={[g.players[0]]:'solids',[g.players[1]]:'stripes'};
    });
  });
  const canvas = page.locator('.pool-canvas');
  const rect = await canvas.boundingBox();
  await canvas.click({position:{x:rect.width/2,y:rect.height*14/112}});
  await page.getByRole('slider',{name:'Power',exact:true}).fill('0.5');
  await page.getByRole('button',{name:'Shoot',exact:true}).click();
  await expect(page.locator('.pool-game')).toHaveAttribute('aria-busy','true');
  await expect(page.locator('.game-result')).toBeHidden();
  await expect(page.locator('.pool-game')).toHaveAttribute('aria-busy','false',{timeout:6000});
  await expect(page.getByText('YOU WON!',{exact:true})).toBeVisible();
});

async function observeCardAudio(page) {
  await page.addInitScript(() => {
    localStorage.setItem('cp_music_off', '1');
    const decoded = new WeakSet();
    window.cardAudio = {decoded: 0, starts: [], stops: 0};
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = async function (...args) {
      const buffer = await decode.apply(this, args);
      decoded.add(buffer);
      window.cardAudio.decoded++;
      return buffer;
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.cardAudio.starts.push({recorded: decoded.has(this.buffer), at: args[0], duration: args[2]});
      return start.apply(this, args);
    };
    const stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.stop = function (...args) {
      window.cardAudio.stops++;
      return stop.apply(this, args);
    };
  });
}

for (const size of [{width:360,height:640}, {width:1280,height:800}, {width:844,height:390}]) {
  test(`Call Break table, readable hand and recorded throws ${size.width}x${size.height}`, async ({page}, testInfo) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(size);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await observeCardAudio(page);
    await signIn(page);
    await expect.poll(() => page.evaluate(() => window.cardAudio.decoded)).toBe(5);
    await openGame(page, 'game-card--callbreak');
    await expect(page.locator('.cb-hud')).toContainText('ROUND');
    await expect(page.locator('.cb-hand .hand-card')).toHaveCount(13);
    await page.locator('.cb-score-toggle').click();
    await expect(page.getByRole('region',{name:'Call Break scores',exact:true})).toContainText('Scores appear after the first round.');
    await page.getByRole('button',{name:'Close scores',exact:true}).click();
    await page.getByRole('group',{name:'Your bid',exact:true}).getByRole('button',{name:'1',exact:true}).click();
    await expect.poll(async () => (await gameState(page)).phase).toBe('play');
    await expect(page.locator('.fly-card')).toHaveCount(0);
    await page.evaluate(() => {window.cardAudio.starts = [];});
    await page.locator('.cb-hand .is-playable').first().click();
    await expect(page.locator('.cb-hand .hand-card')).toHaveCount(12);
    await expect.poll(() => page.evaluate(() => window.cardAudio.starts.length), {intervals:[20]}).toBe(2);
    const sounds = await page.evaluate(() => window.cardAudio.starts);
    expect(sounds.every(sound => sound.recorded)).toBe(true);
    expect(sounds[1].at - sounds[0].at).toBeCloseTo(0.3, 2);
    await expect(page.locator('.fly-card')).toHaveCount(0);
    await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map(e => e.name).find(u => u.includes('/src/backend/store.ts'));
      const {api,getDB} = await import(url);
      const {callBreakGame,legalCards} = await import('/src/games/callbreak.tsx');
      const g = getDB().games.at(-1);
      let state = {...callBreakGame.init(g.players),phase:'play',bids:[1,2,3,4],turn:1};
      for (let seat=1;seat<4;seat++) state=callBreakGame.apply(state,{type:'play',card:legalCards(state.hands[seat],state.trick)[0].id},g.players[seat]);
      api.updateGame(g.id,s=>{s.state=state;});
    });
    await expect(page.locator('.cb-played')).toHaveCount(3);
    await expect(page.locator('.fly-card')).toHaveCount(0);
    const layout = await page.locator('.cb-game').evaluate(root => {
      const box = node => {const r=node.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      return {root:box(root), dock:box(root.querySelector('.cb-hand-dock')), hand:box(root.querySelector('.cb-hand')), body:box(root.parentElement),
        cards:[...root.querySelectorAll('.cb-hand .hand-card')].map(box),
        played:[...root.querySelectorAll('.cb-played')].map(box), seats:[...root.querySelectorAll('.cb-seat')].map(box),
        overflow:root.parentElement.scrollHeight-root.parentElement.clientHeight};
    });
    expect(layout.overflow).toBeLessThanOrEqual(2);
    expect(layout.body.bottom-layout.dock.bottom).toBeLessThan(20);
    for (const card of layout.cards) {
      expect(card.left).toBeGreaterThanOrEqual(layout.hand.left-1);
      expect(card.right).toBeLessThanOrEqual(layout.hand.right+1);
      expect(card.width).toBeGreaterThanOrEqual(size.width===360?44:42);
    }
    for (const played of layout.played) for (const seat of layout.seats) {
      const overlap=Math.max(0,Math.min(played.right,seat.right)-Math.max(played.left,seat.left))*Math.max(0,Math.min(played.bottom,seat.bottom)-Math.max(played.top,seat.top));
      expect(overlap,`trick overlaps seat: ${JSON.stringify({played,seat})}`).toBe(0);
    }
    await page.screenshot({path:testInfo.outputPath('callbreak-playing.png')});
    if (size.width===360) {
      await page.evaluate(async () => {
        const url=performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/backend/store.ts'));
        const {api,getDB}=await import(url);
        const {callBreakGame,legalCards}=await import('/src/games/callbreak.tsx');
        const g=getDB().games.at(-1);
        let state=g.state;
        while(state.phase==='play') state=callBreakGame.apply(state,{type:'play',card:legalCards(state.hands[state.turn],state.trick)[0].id},state.players[state.turn]);
        api.updateGame(g.id,s=>{s.state=state;});
      });
      await expect(page.getByRole('region',{name:'Call Break scores',exact:true})).toContainText('Round 1 scores');
      await expect.poll(async () => (await gameState(page)).round,{timeout:7000}).toBe(2);
      await expect(page.locator('.cb-hand .hand-card')).toHaveCount(13);
    }
    expect(errors).toEqual([]);
  });
}

test('recorded card sounds respect mute and unavailable assets do not synthesize replacements',async ({page,context}) => {
  await observeCardAudio(page);
  await signIn(page);
  await expect.poll(()=>page.evaluate(()=>window.cardAudio.decoded)).toBe(5);
  const muted = await page.evaluate(async () => {
    const url=performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/games/sfx.ts'));
    const {play,setMuted}=await import(url);
    window.cardAudio.starts=[];
    play('shuffle');
    const shuffleDuration=window.cardAudio.starts[0].duration;
    setMuted(true);
    setMuted(false);
    window.cardAudio.starts=[];
    play('card');
    const before=window.cardAudio.stops;
    setMuted(true);
    const stopped=window.cardAudio.stops-before;
    const count=window.cardAudio.starts.length;
    play('card');play('shuffle');
    const whileMuted=window.cardAudio.starts.length;
    setMuted(false);
    return {count,whileMuted,after:window.cardAudio.starts.length,stopped,shuffleDuration};
  });
  expect(muted).toMatchObject({count:2,whileMuted:2,after:2,stopped:2});
  expect(muted.shuffleDuration).toBeLessThanOrEqual(0.47);
  const offline=await context.newPage();
  await observeCardAudio(offline);
  await offline.route('**/media/audio/cards/*.ogg',route=>route.abort());
  await offline.goto('http://127.0.0.1:5174');
  await offline.locator('body').click({position:{x:2,y:2}});
  const offlineResult=await offline.evaluate(async () => {
    const url=performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/games/sfx.ts'));
    const {play}=await import(url);
    window.cardAudio.starts=[];
    play('card');play('shuffle');play('deal');
    return window.cardAudio;
  });
  expect(offlineResult.decoded).toBe(0);
  expect(offlineResult.starts).toEqual([]);
});
