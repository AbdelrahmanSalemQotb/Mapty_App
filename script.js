/* global L */

"use strict";

class Workout {
  constructor(coords, distance, duration, date = new Date()) {
    if (new.target === Workout) {
      throw new Error("Cannot instantiate abstract class Workout directly.");
    }

    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
    this.date = new Date(date);
    this.id = date.getTime().toString().slice(-10);
  }

  _generateDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const typeString = this.type[0].toUpperCase() + this.type.slice(1);
    this.description = `${typeString} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
  edit(distance, duration) {
    this.distance = distance;
    this.duration = duration;
  }
}

class Running extends Workout {
  type = "running";
  constructor(coords, distance, duration, cadence, date = new Date()) {
    super(coords, distance, duration, date);
    this.cadence = cadence;
    this._clacPace();
    this._generateDescription();
  }

  _clacPace() {
    this.pace = this.duration / this.distance;
  }

  edit(distance, duration, cadence) {
    super.edit(distance, duration);
    this.cadence = cadence;
    this._clacPace();
  }
}

class Cycling extends Workout {
  type = "cycling";
  constructor(coords, distance, duration, elevGain, date = new Date()) {
    super(coords, distance, duration, date);
    this.elevGain = elevGain;
    this._clacSpeed();
    this._generateDescription();
  }

  _clacSpeed() {
    this.speed = this.distance / (this.duration / 60);
  }
  edit(distance, duration, elevGain) {
    super.edit(distance, duration);
    this.elevGain = elevGain;
    this._clacSpeed();
  }
}

const resetBtn = document.querySelector(".reset--btn");

const editFormElement = document.querySelector("#editModal");
const inputEditDistance = document.querySelector(
  "#editModal .form__input--distance"
);
const inputEditDuration = document.querySelector(
  "#editModal .form__input--duration"
);
const inputEditType = document.querySelector("#editModal .form__input--type");
const inputEditCadence = document.querySelector(
  "#editModal .form__input--cadence"
);
const inputEditElevation = document.querySelector(
  "#editModal .form__input--elevation"
);

const form = document.querySelector(".workouts .form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".workouts .form .form__input--type");
const inputDistance = document.querySelector(
  ".workouts .form__input--distance"
);
const inputDuration = document.querySelector(
  ".workouts  .form__input--duration"
);
const inputCadence = document.querySelector(".workouts  .form__input--cadence");
const inputElevation = document.querySelector(
  ".workouts  .form__input--elevation"
);

class App {
  #map = L.map("map");
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #workoutToEdit;
  #mapLayerGroup = L.featureGroup();

  constructor() {
    this._getPosition();
    this._getLocalStorage();

    this.layerMap = new Map();

    inputType.addEventListener("change", this._toggleElevationField);
    form.addEventListener("submit", this._newWorkout.bind(this));
    containerWorkouts.addEventListener(
      "click",
      this._warningModalShow.bind(this)
    );
    containerWorkouts.addEventListener(
      "click",
      this._editWorkoutShow.bind(this)
    );
    containerWorkouts.addEventListener("click", this._moveToPopup.bind(this));
    editFormElement.addEventListener(
      "submit",
      this._editWorkoutSubmit.bind(this)
    );

    resetBtn.addEventListener("click", this._warningModalShow.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._showMap.bind(this),
        function () {
          alert("Could not get your position switching to default position");
          this._showMap.bind(this)();
        }.bind(this)
      );
    }
  }

  _showForm(mapEvent) {
    this.#mapEvent = mapEvent;
    form.classList.remove("hidden");
    inputDistance.focus();
  }

  _hideForm() {
    form.style.display = "none";
    form.classList.add("hidden");
    setTimeout(() => {
      form.style.display = "grid";
    }, 100);

    //clearing inputs fields
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        "";
  }

  _toggleElevationField() {
    inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
    inputElevation.closest(".form__row").classList.toggle("form__row--hidden");
  }
  _centerMap() {
    const coords = this.#mapLayerGroup.getBounds();

    this.#map.flyToBounds(coords, {
      duration: 1,
      padding: [50, 50],
    });
  }

  _addMapExpand() {
    const expandMap = function () {
      const div = L.DomUtil.create("div", "custom-control-class");
      div.innerHTML = `<i class="fa-solid fa-maximize expand--icon"></i>`;

      L.DomEvent.on(
        div,
        "click",
        function (e) {
          e.stopImmediatePropagation();
          this._centerMap();
        }.bind(this)
      );

      return div;
    }.bind(this);

    const CustomControl = L.Control.extend({
      onAdd: expandMap,

      onRemove: function () {},
    });

    const customControl = new CustomControl({ position: "bottomleft" });
    customControl.addTo(this.#map);
  }

  _showMap(e) {
    const { latitude, longitude } = e
      ? e.coords
      : { latitude: 30.044968, longitude: 31.244174 };

    const coords = [latitude || 30.044968, longitude || 31.244174];

    this.#map.setView(coords, this.#mapZoomLevel);

    L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
      maxZoom: this.#mapZoomLevel,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    })
      .addTo(this.#map)
      .on("tileerror", function (error) {
        console.error("Tile loading error:", error);
      });

    this.#map.on("click", this._showForm.bind(this));
    this._addMapExpand();
  }

  _goToMarker(coords) {
    //go to marker
    this.#map.flyTo(coords, this.#mapZoomLevel, {
      duration: 1, // Duration in seconds
    });
  }

  _markerDelete(index) {
    const layerKey = this.#workouts.at(index).coords.toString();
    const layerToRemove = this.layerMap.get(layerKey);
    if (layerToRemove) {
      this.#mapLayerGroup.removeLayer(layerToRemove);
      this.layerMap.delete(layerKey);
    }
    // this.#mapLayerGroup.eachLayer(
    //   function (layer) {
    //     if (
    //       layer.getLatLng().lat === this.#workouts.at(index).coords[0] &&
    //       layer.getLatLng().lng === this.#workouts.at(index).coords[1]
    //     ) {
    //       this.#mapLayerGroup.removeLayer(layer);
    //     }
    //   }.bind(this)
    // );
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords);

    this.#mapLayerGroup.addLayer(marker);

    const popupContent = `
    <p>${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}</p>
  `;
    marker
      .bindPopup(popupContent, {
        maxWidth: 250,
        minWidth: 100,
        autoClose: false,
        closeOnClick: false,
        className: `${workout.type}-popup`, // Use className, not class
      })
      .openPopup();

    this._goToMarker(workout.coords);

    //store map layer
    this.layerMap.set(workout.coords.toString(), marker);
  }

  _renderWorkoutList(workout) {
    let workoutIcons, workoutUnits, workoutCalculation, cadenceElevation;

    if (workout.type === "running") {
      workoutIcons = ["🏃‍♂️", "🦶🏼"];
      workoutUnits = ["min/km", "spm"];
      workoutCalculation = workout.pace;
      cadenceElevation = workout.cadence;
    } else {
      workoutIcons = ["🚴‍♀️", "⛰"];
      workoutUnits = ["km/h", "m"];
      workoutCalculation = workout.speed;
      cadenceElevation = workout.elevGain;
    }

    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__control" >
          <i class="far fa-edit workout__control--icon" role="button" tabindex="0" aria-label="Edit workout" ></i>
          <i class="fa-solid fa-trash workout__control--icon" role="button" tabindex="0" aria-label="Delete workout"></i>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${workoutIcons[0]}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workoutCalculation.toFixed(1)}</span>
          <span class="workout__unit">${workoutUnits[0]}</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${workoutIcons[1]}</span>
          <span class="workout__value">${cadenceElevation}</span>
          <span class="workout__unit">${workoutUnits[1]}</span>
        </div>
      </li>`;

    form.insertAdjacentHTML("afterend", html);
  }

  _editRenderdListWorkout(workout) {
    let workoutIcons, workoutUnits, workoutCalculation, cadenceElevation;

    if (workout.type === "running") {
      workoutIcons = ["🏃‍♂️", "🦶🏼"];
      workoutUnits = ["min/km", "spm"];
      workoutCalculation = workout.pace;
      cadenceElevation = workout.cadence;
    } else {
      workoutIcons = ["🚴‍♀️", "⛰"];
      workoutUnits = ["km/h", "m"];
      workoutCalculation = workout.speed;
      cadenceElevation = workout.elevGain;
    }

    const listWorkout = containerWorkouts.querySelector(
      `.workout[data-id="${workout.id}"]`
    );

    let html = `
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__control" >
          <i class="far fa-edit workout__control--icon" role="button" tabindex="0" aria-label="Edit workout" ></i>
          <i class="fa-solid fa-trash workout__control--icon" role="button" tabindex="0" aria-label="Delete workout"></i>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${workoutIcons[0]}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workoutCalculation.toFixed(1)}</span>
          <span class="workout__unit">${workoutUnits[0]}</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${workoutIcons[1]}</span>
          <span class="workout__value">${cadenceElevation}</span>
          <span class="workout__unit">${workoutUnits[1]}</span>
        </div>`;

    listWorkout.innerHTML = html;
  }

  _newWorkout(e) {
    const checkPositve = function (...inputs) {
      return inputs.every((input) => input > 0);
    };
    const checknumber = function (...inputs) {
      return inputs.every((input) => Number.isFinite(input));
    };

    e.preventDefault();
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    if (type === "running") {
      const cadence = +inputCadence.value;
      if (!checknumber(distance, duration, cadence))
        return alert("inputs must be number");
      if (!checkPositve(distance, duration, cadence))
        return alert("inputs must be a positive number");

      workout = new Running([lat, lng], +distance, +duration, +cadence);
    }

    if (type === "cycling") {
      const elevation = +inputElevation.value;
      if (!checknumber(distance, duration, elevation))
        return alert("inputs must be number");
      if (!checkPositve(distance, duration))
        return alert("inputs must be a positive number");

      workout = new Cycling([lat, lng], +distance, +duration, +elevation);
    }

    this.#workouts.push(workout);

    this._renderWorkoutMarker(workout);

    this._renderWorkoutList(workout);

    this._hideForm();

    this._setLocalStorage();
  }

  _click(workout) {
    workout.click();
    this._setLocalStorage();
  }

  _moveToPopup(e) {
    const id = e.target.closest(".workout")?.dataset.id;
    if (!id) return;

    const workout = this.workouts.find((workout) => workout.id === id);

    this._click(workout);

    this._goToMarker(workout.coords);
  }

  _setLocalStorage() {
    window.localStorage.setItem("workouts", JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const workouts = JSON.parse(window.localStorage.getItem("workouts"));
    if (!workouts) return;

    /* */

    this.#workouts = workouts.map((workout) => this._parseWorkout(workout));

    // this.#workouts = workouts;

    this.#workouts.forEach((workout) => {
      this._renderWorkoutList(workout);
    });

    const markersGenerator = function () {
      this.#mapLayerGroup.addTo(this.#map);

      this.#workouts.forEach((work) => {
        this._renderWorkoutMarker(work);
      });
      this.#map.off("load", markersGenerator);
    }.bind(this);

    this.#map.on("load", markersGenerator);
  }

  _parseWorkout(workout) {
    let instance;

    switch (workout.type) {
      case "running":
        instance = Object.create(Running.prototype);
        Object.assign(instance, workout);
        break;

      case "cycling":
        instance = Object.create(Cycling.prototype);
        Object.assign(instance, workout);
        break;

      default:
        throw new Error("Unknown type");
    }

    if (workout.date) {
      instance.date = new Date(workout.date);
    }

    return instance;
  }

  _warningModalShow(e) {
    const deleteBtnCondition =
      e.target.classList.contains("workout__control--icon") &&
      e.target.ariaLabel === "Delete workout";
    const resetBtnCondition = e.target.classList.contains("reset--btn");

    if (deleteBtnCondition) {
      this._deleteWorkout.call(this, e);
    } else if (resetBtnCondition) {
      this._reset(e);
    }
  }

  _deleteWorkout(e) {
    e.stopImmediatePropagation();
    const workout = e.target.closest(".workout");
    const modal = document.querySelector("#confirmModal");
    const confirmationYesButton = document.querySelector("#confirmYes");
    const confirmationNoButton = document.querySelector("#confirmNo");

    const confirmModalP = modal.querySelector(".modal-content p");
    confirmModalP.innerText = "Are you sure you want to delete this workout?";

    modal.classList.remove("hidden");

    const confirmationHandler = function () {
      const index = this.#workouts.findIndex(
        (work) => work.id === workout.dataset.id
      );
      if (index === -1) return;
      this._markerDelete.call(this, index);

      this.#workouts.splice(index, 1);

      workout.remove();
      modal.classList.add("hidden");
      this._setLocalStorage();
    }.bind(this);
    confirmationYesButton.onclick = confirmationHandler.bind(this);
    confirmationNoButton.onclick = () => modal.classList.add("hidden");
  }

  _hideEditForm() {
    editFormElement.classList.add("hidden");
    //reset form
    inputEditDistance.value = "";
    inputEditDuration.value = "";
    inputEditType.value = "";
    inputEditCadence.value = "";
    inputEditElevation.value = "";
  }

  _editWorkoutShow(e) {
    if (
      !(
        e.target.classList.contains("workout__control--icon") &&
        e.target.ariaLabel === "Edit workout"
      )
    )
      return;
    e.stopImmediatePropagation();
    const workoutelement = e.target.closest(".workout");
    this.#workoutToEdit = this.#workouts.find(
      (element) => element.id === workoutelement.dataset.id
    );

    inputEditType.value = this.#workoutToEdit.type;
    inputEditDistance.value = this.#workoutToEdit.distance;
    inputEditDuration.value = this.#workoutToEdit.duration;

    if (this.#workoutToEdit.type === "running") {
      inputEditCadence.value = this.#workoutToEdit.cadence;
      inputEditCadence
        .closest(".form__row")
        .classList.remove("form__row--hidden");
      inputEditElevation
        .closest(".form__row")
        .classList.add("form__row--hidden");
    } else {
      inputEditElevation.value = this.#workoutToEdit.elevGain;
      inputEditElevation
        .closest(".form__row")
        .classList.remove("form__row--hidden");
      inputEditCadence.closest(".form__row").classList.add("form__row--hidden");
    }

    editFormElement.classList.remove("hidden");

    const modalClose = document.querySelector("#editModal .modal-close");
    modalClose.onclick = this._hideEditForm;
  }

  _editWorkoutSubmit(e) {
    e.preventDefault();
    const checkPositve = function (...inputs) {
      return inputs.every((input) => input > 0);
    };
    const checknumber = function (...inputs) {
      return inputs.every((input) => Number.isFinite(input));
    };

    const type = inputEditType.value;
    const distance = +inputEditDistance.value;
    const duration = +inputEditDuration.value;

    if (type === "running") {
      const cadence = +inputEditCadence.value;
      if (!checknumber(distance, duration, cadence))
        return alert("inputs must be number");
      if (!checkPositve(distance, duration, cadence))
        return alert("inputs must be a positive number");

      this.#workoutToEdit.edit(distance, duration, cadence);
    }

    if (type === "cycling") {
      const elevation = +inputEditElevation.value;
      if (!checknumber(distance, duration, elevation))
        return alert("inputs must be number");
      if (!checkPositve(distance, duration))
        return alert("inputs must be a positive number");

      this.#workoutToEdit.edit(distance, duration, elevation);
    }

    this._hideEditForm();

    this._editRenderdListWorkout(this.#workoutToEdit);

    this._setLocalStorage();
  }

  _reset(e) {
    e.stopImmediatePropagation();
    const modal = document.querySelector("#confirmModal");
    const confirmationYesButton = document.querySelector("#confirmYes");
    const confirmationNoButton = document.querySelector("#confirmNo");

    const confirmModalP = modal.querySelector(".modal-content p");
    confirmModalP.innerHTML =
      "Are you sure you want to <span>delete All workouts</span>?";

    modal.classList.remove("hidden");

    const confirmationHandler = function () {
      localStorage.removeItem("workouts");
      location.reload();
    }.bind(this);
    confirmationYesButton.onclick = confirmationHandler.bind(this);
    confirmationNoButton.onclick = () => modal.classList.add("hidden");
  }
}

// eslint-disable-next-line no-unused-vars
const app = new App();
