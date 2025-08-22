// =====================
// NO-API Weather Engine
// =====================

// UI elements
const cityInput = document.getElementById("city-input");
const searchForm = document.getElementById("search-form");
const geoBtn = document.getElementById("geo-btn");
const unitBtn = document.getElementById("unit-btn");

const placeEl = document.getElementById("place");
const descEl = document.getElementById("desc");
const timeEl = document.getElementById("time");
const tempEl = document.getElementById("temp");
const minmaxEl = document.getElementById("minmax");
const windEl = document.getElementById("wind");
const humidityEl = document.getElementById("humidity");
const feelsEl = document.getElementById("feels");
const pressureEl = document.getElementById("pressure");
const iconEl = document.getElementById("icon");
const forecastWrap = document.getElementById("forecast");

let unit = "metric"; // "metric" or "imperial"

// --- helpers ---
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toF = c => Math.round(c * 9/5 + 32);
const fmtTemp = t => unit === "metric" ? Math.round(t) : toF(t);
const fmtSpeed = s => unit === "metric" ? `${Math.round(s)} m/s` : `${Math.round(s*2.237)} mph`; // m/s -> mph
const nowLocal = () => new Date();

function setWeatherClass(main){
  document.body.classList.remove("sunny","rainy","cloudy","snowy");
  const m = main.toLowerCase();
  if (m.includes("rain")) document.body.classList.add("rainy");
  else if (m.includes("snow")) document.body.classList.add("snowy");
  else if (m.includes("cloud")) document.body.classList.add("cloudy");
  else document.body.classList.add("sunny");
}

function iconFor(main){
  if (main.includes("Thunder")) return "⛈️";
  if (main.includes("Drizzle")) return "🌦️";
  if (main.includes("Rain")) return "🌧️";
  if (main.includes("Snow")) return "❄️";
  if (main.includes("Cloud")) return "☁️";
  if (main.includes("Fog") || main.includes("Haze")) return "🌫️";
  return "☀️";
}

// Deterministic pseudo-random (mulberry32)
function seedFromString(str){
  let h = 1779033703 ^ str.length;
  for (let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Core generator: produces consistent "weather" from a key (city or coords) + time
function generateWeather(key, lat=null){
  const date = new Date();
  const dayKey = `${date.getUTCFullYear()}-${date.getUTCMonth()+1}-${date.getUTCDate()}`;
  const seed = seedFromString(`${key}-${dayKey}`);
  const rand = mulberry32(seed);

  // base temp (°C) affected by latitude if provided
  let base = 20 + (lat!==null ? (15 - Math.abs(lat)/6) : 0); // colder further from equator
  base += (rand() - 0.5) * 6; // daily randomness

  // diurnal variation (sine wave – warmer in afternoon)
  const hr = date.getHours() + date.getMinutes()/60;
  const diurnal = 6 * Math.sin((Math.PI * (hr - 14)) / 12); // peak ~14:00
  const temp = clamp(base + diurnal, -10, 42);

  // choose sky condition weighted by humidity/random
  const humidity = Math.round(40 + rand()*60); // 40–100
  const wind = (1 + rand()*7); // m/s
  const pressure = Math.round(990 + rand()*30); // hPa

  const skyRoll = rand();
  let main="Clear", desc="clear sky";
  if (humidity > 75 && skyRoll > 0.6) { main="Rain"; desc="light to moderate rain"; }
  else if (skyRoll > 0.75) { main="Clouds"; desc="broken clouds"; }
  else if (skyRoll > 0.6) { main="Clouds"; desc="scattered clouds"; }
  else if (humidity < 45 && skyRoll < 0.15) { main="Haze"; desc="hazy"; }

  // compute min/max for the day around current temp
  const min = clamp(temp - (2 + rand()*3), -12, 40);
  const max = clamp(temp + (2 + rand()*3), -8, 45);

  return { temp, min, max, humidity, wind, pressure, main, desc };
}

// Forecast generator (next 5 three-hour slots)
function generateForecast(baseKey, startTemp){
  const out = [];
  const date = new Date();
  for(let i=1;i<=5;i++){
    const t = new Date(date.getTime() + i*3*3600*1000);
    const key = `${baseKey}-${t.getUTCHours()}`;
    const seed = seedFromString(key);
    const r = mulberry32(seed)();
    const wiggle = (Math.sin(i/2) * 1.8) + (r - 0.5) * 2.2;
    const temp = startTemp + wiggle;
    const bucket = r;
    const main =
      bucket < 0.12 ? "Rain" :
      bucket < 0.28 ? "Clouds" :
      bucket < 0.33 ? "Haze" : "Clear";
    out.push({ at: t, temp, main });
  }
  return out;
}

// Renderers
function renderCurrent(cityLabel, weather){
  const now = nowLocal();
  placeEl.textContent = cityLabel;
  descEl.textContent = weather.desc;
  timeEl.textContent = now.toLocaleString();
  tempEl.textContent = fmtTemp(weather.temp);
  minmaxEl.textContent = `H: ${fmtTemp(weather.max)}°  L: ${fmtTemp(weather.min)}°`;
  windEl.textContent = fmtSpeed(weather.wind);
  humidityEl.textContent = `${weather.humidity}%`;
  feelsEl.textContent = `${fmtTemp(weather.temp - 0.4*(weather.temp - 10) + (weather.humidity-50)/50)}°`;
  pressureEl.textContent = `${weather.pressure} hPa`;
  iconEl.textContent = iconFor(weather.main);
  setWeatherClass(weather.main);
}

function renderForecast(cityKey, list){
  forecastWrap.innerHTML = "";
  list.forEach(item=>{
    const time = item.at.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const el = document.createElement("div");
    el.className = "fcard";
    el.innerHTML = `
      <div>${time}</div>
      <div class="emo">${iconFor(item.main)}</div>
      <div class="big">${fmtTemp(item.temp)}°</div>
      <small>${item.main}</small>
    `;
    forecastWrap.appendChild(el);
  });
}

// Search submit
searchForm.addEventListener("submit", (e)=>{
  e.preventDefault();
  const q = (cityInput.value || "").trim();
  if(!q) return toast("Type a city name");
  const weather = generateWeather(q);
  renderCurrent(q, weather);
  renderForecast(q, generateForecast(q, weather.temp));
});

// Geolocation
geoBtn.addEventListener("click", ()=>{
  if(!navigator.geolocation) return toast("Geolocation not supported");
  navigator.geolocation.getCurrentPosition(pos=>{
    const { latitude, longitude } = pos.coords;
    const label = `Your location (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
    const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    const weather = generateWeather(key, latitude);
    renderCurrent(label, weather);
    renderForecast(key, generateForecast(key, weather.temp));
  }, ()=>{
    toast("Location permission denied");
  });
});

// Unit toggle
unitBtn.addEventListener("click", ()=>{
  unit = unit === "metric" ? "imperial" : "metric";
  unitBtn.textContent = unit === "metric" ? "°C" : "°F";
  // Re-render with current values by simulating a quick refresh
  const label = placeEl.textContent || "Demo City";
  const key = label.replace("Your location (","").replace(")","");
  const weather = generateWeather(key);
  renderCurrent(label, weather);
  renderForecast(key, generateForecast(key, weather.temp));
});

// Toast
function toast(msg){
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.position = "fixed";
  t.style.left = "50%";
  t.style.top = "20px";
  t.style.transform = "translateX(-50%)";
  t.style.background = "rgba(0,0,0,.65)";
  t.style.color = "#fff";
  t.style.padding = "10px 14px";
  t.style.borderRadius = "12px";
  t.style.boxShadow = "0 6px 18px #0008, inset 0 0 0 1px #fff2";
  t.style.zIndex = 9999;
  document.body.appendChild(t);
  setTimeout(()=> t.remove(), 2200);
}

// Initial demo render
(function init(){
  const demoCity = "Chennai";
  const w = generateWeather(demoCity, 13.08);
  renderCurrent(demoCity, w);
  renderForecast(demoCity, generateForecast(demoCity, w.temp));
})();

