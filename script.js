const pubnub = new PubNub({
	subscribeKey: "sub-c-10e0e350-30c8-4f8c-84dc-659f6954424e",
	uuid: "webClient",
});

pubnub.addListener({
	message: function (message) {
		console.log(message.message);
		updateBusMarker(message.message);
	},
	presence: function (message) {
		console.log(message);
	},
	signal: function (message) {
		console.log(message.message);
		updateBusMarker(message.message);
	},
});

mapboxgl.accessToken =
	"pk.eyJ1IjoibGFrc2h5YWplZXQiLCJhIjoiY2tuMWM2amttMHN0NDJ3cXVxOGJsY3p4MiJ9.LuGi_8FfhyDQHtWqHRgcjw";

const map = new mapboxgl.Map({
	container: "map",
	style: "mapbox://styles/lakshyajeet/clc3bmrhi005y14s1vk7tqr45",
	center: [79.51, 29.1869],
	zoom: 12,
	hash: true,
	maxPitch: 45,
	doubleClickZoom: false,
});

map.addControl(
	new mapboxgl.GeolocateControl({
		positionOptions: {
			enableHighAccuracy: true,
		},
		trackUserLocation: true,
		showUserHeading: true,
	}),
	"bottom-right"
);
map.addControl(new busTrackingStateSwitcher(), "bottom-right");

const busInputs = document.getElementById("bus").getElementsByTagName("input");
const shiftInputs = document
	.getElementById("shift")
	.getElementsByTagName("input");

for (const input of busInputs) {
	input.onclick = (bus) => {
		busNo = bus.target.value;
		changeBusRoute(true);
	};
	if (input.checked) {
		busNo = input.value;
	}
}

for (const input of shiftInputs) {
	input.onclick = (shift) => {
		shiftNo = shift.target.value;
		changeBusRoute();
	};
	if (input.checked) {
		shiftNo = input.value;
	}
}

map.on("load", () => {
	changeBusRoute(true);
	//GEHU Icon
	map.loadImage("media/logo.png", (error, image) => {
		if (error) throw error;
		map.addImage("cat", image);
		map.addSource("GEHU-icon-source", {
			type: "geojson",
			data: {
				type: "FeatureCollection",
				features: [
					{
						type: "Feature",
						geometry: {
							type: "Point",
							coordinates: [79.51564595103264, 29.12450375392585],
						},
					},
				],
			},
		});
		map.addLayer({
			id: "GEHU-icon-layer",
			type: "symbol",
			source: "GEHU-icon-source",
			layout: {
				"icon-image": "cat",
				"icon-size": [
					"interpolate",
					["linear"],
					["zoom"],
					0,
					0.01,
					12,
					0.05,
					22,
					0.2,
				],
			},
		});
		map.on("dblclick", "GEHU-icon-layer", (e) => {
			map.flyTo({
				center: e.features[0].geometry.coordinates,
				zoom: 15,
			});
		});

		// Change the cursor to a pointer when the it enters a feature in the 'circle' layer.
		map.on("mouseenter", "GEHU-icon-layer", () => {
			map.getCanvas().style.cursor = "pointer";
		});

		// Change it back to a pointer when it leaves.
		map.on("mouseleave", "GEHU-icon-layer", () => {
			map.getCanvas().style.cursor = "";
		});
	});
});

// Bus marker

const busMarkerPopup = new mapboxgl.Popup();
const busMarkerElement = document.createElement("div");
busMarkerElement.className = "bus-marker-element";
const busMarker = new mapboxgl.Marker({
	element: busMarkerElement,
	anchor: "center",
})
	.setLngLat([0, 0])
	.addTo(map)
	.setPopup(busMarkerPopup);
if ("vibrate" in navigator) {
	busMarkerElement.onclick = () => {
		navigator.vibrate(250);
	};
}
busMarkerElement.ondblclick = () => {
	setTrackingState(2);
};

updateTimeDelay();

function changeTrackedBus() {
	let channel = `bus_${busNo}`;
	pubnub.unsubscribeAll();
	busMarker.remove();
	busLat = null;
	busLan = null;
	setTrackingState(0);
	try {
		pubnub.fetchMessages(
			{
				channels: [channel],
				count: 1,
			},
			function (status, response) {
				if ((status.statusCode = 200) && response)
					updateBusMarker(response.channels[channel][0].message);
			}
		);
	} catch {
		console.log("Unable to load history.");
	}
	pubnub.subscribe({
		channels: [channel],
	});
}

function changeBusRoute(busChange) {
	if (map.getLayer("route")) {
		map.removeLayer("route");
	}
	if (map.getSource("route")) {
		map.removeSource("route");
	}
	fetch(`data/${busNo + shiftNo}.geojson`)
		.then((response) => {
			return response.json();
		})
		.then((geojson) => {
			map.addSource("route", {
				type: "geojson",
				data: geojson,
			});
			map.addLayer(
				{
					id: "route",
					type: "line",
					source: "route",
					layout: {
						"line-join": "round",
						"line-cap": "round",
					},
					paint: {
						"line-color": "#05cb63",
						"line-width": 8,
						"line-opacity": 0.8,
					},
				},
				"road-label-navigation"
			);

			const coordinates = geojson.features[0].geometry.coordinates;

			// Create a 'LngLatBounds' with both corners at the first coordinate.
			routeBounds = new mapboxgl.LngLatBounds(
				coordinates[0],
				coordinates[0]
			);

			// Extend the 'LngLatBounds' to include every coordinate in the bounds result.
			for (const coord of coordinates) {
				routeBounds.extend(coord);
			}

			map.fitBounds(routeBounds, {
				padding: 50,
			});
		})
		.catch((err) => {
			console.log("Route not found");
		});

	if (busChange) {
		changeTrackedBus();
	}
}
