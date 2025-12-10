const MAX_POKE_LIMIT = 251; // we'll fetch up to Gen 2
let pokemonList = [];
let current = null;
let score = 0;
let triesLeft = 6;
let currentLimit = 151; // default: Gen 1

const el = {
  imageWrap: document.getElementById('image-wrap'),
  pokeImage: document.getElementById('poke-image'),
  guessInput: document.getElementById('guess-input'),
  guessButton: document.getElementById('guess-button'),
  revealButton: document.getElementById('reveal-button'),
  nextButton: document.getElementById('next-button'),
  score: document.getElementById('score'),
  tries: document.getElementById('tries'),
  message: document.getElementById('message'),
  genSelect: document.getElementById('gen-select'),
  dailyToggle: document.getElementById('daily-toggle'),
  suggestions: document.getElementById('suggestions'),
};

function normalizeName(s){
  return String(s).toLowerCase().replace(/[^a-z]/g,'');
}

async function fetchPokemonList(){
  try{
    // fetch names up to MAX_POKE_LIMIT (Gen 1 + Gen 2)
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${MAX_POKE_LIMIT}`);
    const data = await res.json();
    pokemonList = data.results.map(r => r.name);
    el.message.textContent = 'Ready — have fun!';
  }catch(e){
    el.message.textContent = 'Could not load Pokémon names. Check your internet connection.';
    console.error(e);
  }
}

async function startRound(){
  disableControls(false);
  el.choices.innerHTML = '';
  el.guessInput.value = '';
  triesLeft = 6;
  updateTries();
  el.imageWrap.classList.add('silhouette');
  el.pokeImage.src = '';
  el.message.textContent = 'Loading Pokémon...';
  // Choose id depending on daily toggle
  let id;
  if(el.dailyToggle && el.dailyToggle.checked){
    id = computeDailyId(currentLimit);
    if(el.nextButton) el.nextButton.disabled = true; // disable skipping
    el.message.textContent = 'Daily puzzle — good luck!';
  }else{
    id = Math.floor(Math.random() * currentLimit) + 1;
    if(el.nextButton) el.nextButton.disabled = false;
  }
  try{
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const data = await res.json();
    const name = data.name;
    const sprite = data.sprites.other['official-artwork'].front_default || data.sprites.front_default;
    current = { id, name, sprite };
    if(!sprite){
      el.pokeImage.alt = 'Artwork not available';
      el.pokeImage.src = '';
    }else{
      el.pokeImage.src = sprite;
    }

    // no side choices — use autocomplete suggestions instead
    el.message.textContent = 'Guess the Pokémon!';
  }catch(e){
    el.message.textContent = 'Error loading Pokémon artwork.';
    console.error(e);
  }
}

// compute deterministic daily id (1..limit) using days since epoch (UTC)
function computeDailyId(limit){
  const days = Math.floor(Date.now() / 86400000); // days since epoch (UTC)
  const index = days % Math.max(1, limit);
  return index + 1;
}

// AUTOCOMPLETE: show suggestions under input as user types
function updateSuggestions(){
  const q = normalizeName(el.guessInput.value || '');
  const container = el.suggestions;
  container.innerHTML = '';
  if(!q || q.length === 0) return;

  // filter within currentLimit
  const matches = [];
  for(let i=0;i<currentLimit && i<pokemonList.length;i++){
    const name = pokemonList[i];
    if(normalizeName(name).includes(q)) matches.push(name);
    if(matches.length >= 8) break;
  }
  if(matches.length === 0) return;

  const list = document.createElement('div');
  list.className = 'list';
  matches.forEach((name, idx) => {
    const item = document.createElement('div');
    item.className = 'suggestion';
    item.setAttribute('role','option');
    item.setAttribute('data-name', name);
    item.textContent = capitalize(name);
    item.addEventListener('mousedown', (ev) => {
      // mousedown instead of click so input doesn't lose focus before handler
      ev.preventDefault();
      el.guessInput.value = capitalize(name);
      // set focus back and clear suggestions
      el.guessInput.focus();
      container.innerHTML = '';
      // optionally, auto-guess immediately on selection
    });
    list.appendChild(item);
  });
  container.appendChild(list);
}

// hide suggestions (call on blur)
function hideSuggestions(){
  if(el.suggestions) el.suggestions.innerHTML = '';
}

function capitalize(s){
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function handleGuess(guess){
  if(!current) return;
  const gNorm = normalizeName(guess);
  const cNorm = normalizeName(current.name);
  if(gNorm === cNorm){
    // correct
    reveal(true);
  }else{
    triesLeft = Math.max(0, triesLeft - 1);
    updateTries();
    if(triesLeft <= 0){
      reveal(false);
    }else{
      el.message.textContent = `Nope — ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left.`;
    }
  }
}

function updateTries(){
  el.tries.textContent = `Tries left: ${triesLeft}`;
}

function disableControls(disabled){
  el.guessInput.disabled = disabled;
  el.guessButton.disabled = disabled;
  el.revealButton.disabled = disabled;
}

function reveal(won){
  if(!current) return;
  el.imageWrap.classList.remove('silhouette');
  if(won){
    score++;
    el.score.textContent = score;
    el.message.textContent = `Correct! It's ${capitalize(current.name)}.`;
  }else{
    el.message.textContent = `Out of tries — it's ${capitalize(current.name)}.`;
  }
  disableControls(true);
}

el.guessButton.addEventListener('click', () => {
  const val = el.guessInput.value.trim();
  if(!val) return;
  handleGuess(val);
});

el.guessInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter'){
    el.guessButton.click();
  }
});

el.guessInput.addEventListener('input', () => {
  updateSuggestions();
});

el.guessInput.addEventListener('blur', () => {
  // delay hide so click on suggestion registers
  setTimeout(hideSuggestions, 150);
});

el.revealButton.addEventListener('click', () => {
  reveal(false);
});

el.nextButton.addEventListener('click', () => {
  startRound();
});

// handle gen selection changes
if(el.genSelect){
  el.genSelect.addEventListener('change', (e) => {
    const v = Number(e.target.value) || 151;
    currentLimit = Math.min(Math.max(1, v), MAX_POKE_LIMIT);
    el.message.textContent = `Generation set: first ${currentLimit} Pokémon`;
    // start a fresh round for the selected gen
    startRound();
  });
}

if(el.dailyToggle){
  el.dailyToggle.addEventListener('change', (e) => {
    // startRound will pick the daily pokemon when checked
    startRound();
  });
}

// initialize
(async function(){
  await fetchPokemonList();
  // ensure gen select exists before reading it
  if(el.genSelect){
    currentLimit = Number(el.genSelect.value) || 151;
  }
  startRound();
})();
