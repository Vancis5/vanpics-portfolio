const taglines = [
  "collection of all the pics i've ever taken <br> more soon",
  "still adding stuff. check back sometime",
  "i keep the ones nobody else would keep",
  "some of these i really wanna remember",
  "taken between doing other things",
  "things i saw while looking for something else",
  "light, shadow, and a bit of luck",
  "a little bit of everything",
  "started as a habit",
  "taken when something was worth keeping"
];

export function initHeroTagline() {
  const el = document.querySelector('#hero-identity p');
  if (!el) return;

  const visited = localStorage.getItem('van_v3_visited');
  let selected;
  if (!visited) {
    selected = taglines[0];
    localStorage.setItem('van_v3_visited', 'true');
  } else {
    selected = taglines[Math.floor(Math.random() * taglines.length)];
  }
  el.innerHTML = selected;
}

initHeroTagline();
