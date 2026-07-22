// --- CONFIGURATION ---
let map, weatherChart;
const apiKey = "cf47cf24326ab8117baebb9bd38332be";
let isDarkMode = false;

// --- THEME TOGGLE ---
function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.body.style.background = isDarkMode ? '#0f172a' : '#eef2f6';
    document.querySelector(':root').style.setProperty('--bg', isDarkMode ? '#0f172a' : '#eef2f6');
    document.querySelector(':root').style.setProperty('--text', isDarkMode ? '#f1f5f9' : '#1e293b');
    document.querySelector(':root').style.setProperty('--card-bg', isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.65)');
    document.querySelector(':root').style.setProperty('--primary', isDarkMode ? '#f1f5f9' : '#0f172a');
}

// --- FETCH DATA ---
async function fetchData(cityName = null) {
    const city = cityName || document.getElementById('cityInput').value.trim() || "Mumbai";
    document.getElementById('cityInput').value = city;
    document.getElementById('cityDisplay').innerHTML = `<i class="fas fa-city" style="color:var(--accent); margin-right: 8px;"></i> ${city}, IN`;
    document.getElementById('lastUpdated').innerText = "Fetching...";
    document.getElementById('aqiValue').innerText = "--";
    document.getElementById('aqiLabel').innerText = "Loading data...";
    document.getElementById('healthAlert').innerText = "🔍 Analyzing environmental data...";

    try {
        // 1. Geocoding
        const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${apiKey}`);
        const geoData = await geoRes.json();
        if (!geoData.length) throw new Error("City not found.");
        const { lat, lon, name, country } = geoData[0];
        document.getElementById('cityDisplay').innerHTML = `<i class="fas fa-city" style="color:var(--accent); margin-right: 8px;"></i> ${name}, ${country}`;

        // 2. Current Weather
        const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`);
        const weather = await weatherRes.json();

        // 3. Air Quality
        const aqiRes = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`);
        const aqiData = await aqiRes.json();

        // 4. Update Metrics
        document.getElementById('temp').innerText = `${Math.round(weather.main.temp)}°C`;
        document.getElementById('humidity').innerText = `${weather.main.humidity}%`;
        document.getElementById('wind').innerText = `${Math.round(weather.wind.speed * 3.6)} km/h`;
        document.getElementById('pm25').innerText = aqiData.list[0].components.pm2_5;

        // 5. Update AQI & Health Logic
        const aqi = aqiData.list[0].main.aqi;
        let aqiText, color, alertText;
        if (aqi === 1) { aqiText = "Excellent"; color = "#22c55e"; alertText = "🌿 Air quality is excellent. Safe for outdoor activities."; }
        else if (aqi === 2) { aqiText = "Fair"; color = "#fbbf24"; alertText = "😷 Air quality is acceptable. Sensitive groups should limit exposure."; }
        else if (aqi === 3) { aqiText = "Moderate"; color = "#f59e0b"; alertText = "⚠️ Moderate pollution. Consider wearing a mask outdoors."; }
        else { aqiText = "Poor"; color = "#ef4444"; alertText = "🚨 High pollution. It is highly recommended to stay indoors."; }
        
        document.getElementById('aqiValue').innerText = aqiText.toUpperCase();
        document.getElementById('aqiValue').style.background = color;
        document.getElementById('aqiLabel').innerText = `Air Quality Index (${aqi}/5)`;
        document.getElementById('lastUpdated').innerText = `Updated ${new Date().toLocaleTimeString()}`;
        document.getElementById('healthAlert').innerHTML = `<strong>${alertText}</strong>`;
        document.getElementById('healthAlert').style.background = aqi === 1 ? "#dcfce7" : aqi === 2 ? "#fef9c3" : "#fee2e2";

        // 6. Update Map
        updateMap(lat, lon, name);

        // 7. Fetch Forecast
        const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`);
        const forecast = await forecastRes.json();
        updateForecast(forecast);

        // 8. GOOGLE ANALYTICS TRACKING EVENT
        gtag('event', 'city_search', {
            'event_category': 'IntelliAir Dashboard',
            'event_label': city,
            'value': aqi
        });

    } catch (error) {
        document.getElementById('aqiValue').innerText = "Error";
        document.getElementById('aqiLabel').innerText = "City not found. Please check spelling.";
        document.getElementById('lastUpdated').innerText = "Failed";
    }
}

// --- LOCATION ---
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`);
            const geoData = await geoRes.json();
            if (geoData.length) {
                fetchData(geoData[0].name);
                // GA Event for Location
                gtag('event', 'location_used', { 'event_category': 'IntelliAir Dashboard', 'event_label': 'My Location' });
            }
        }, () => alert("Location access denied."));
    } else {
        alert("Geolocation is not supported.");
    }
}

// --- MAP ---
function updateMap(lat, lon, name) {
    if (map) map.remove();
    map = L.map('map').setView([lat, lon], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    L.marker([lat, lon]).addTo(map).bindPopup(name).openPopup();
}

// --- FORECAST ---
function updateForecast(forecast) {
    const container = document.getElementById('forecastContainer');
    container.innerHTML = "";
    const labels = [], temps = [];

    // Grab 7 days of data
    for (let i = 0; i < Math.min(forecast.list.length, 40); i += 8) {
        const day = forecast.list[i];
        const date = new Date(day.dt * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const temp = Math.round(day.main.temp);
        
        labels.push(dayName);
        temps.push(temp);

        // Create Card
        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `<div class="day">${dayName}</div><div class="temp">${temp}°C</div>`;
        container.appendChild(card);
    }

    // Chart
    const ctx = document.getElementById('weatherChart').getContext('2d');
    if (weatherChart) weatherChart.destroy();
    weatherChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temp (°C)',
                data: temps,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.1)',
                fill: true,
                tension: 0.3
            }]
        }
    });
}

// AUTO-LOAD ON START
window.onload = fetchData;