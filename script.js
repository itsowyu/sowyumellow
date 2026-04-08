// Minimum width any window can be resized down to.
const MIN_WINDOW_WIDTH = 250;

// Minimum height any window can be resized down to.
const MIN_WINDOW_HEIGHT = 150;

// Starting z-index used to keep the most recently selected window on top.
let topZIndex = 9;

// Find every draggable window on the page.
document.querySelectorAll(".draggable-window").forEach((win) => {
  // Track the highest starting z-index so we can stack above it later.
  const currentZIndex = Number.parseInt(
    window.getComputedStyle(win).zIndex,
    10,
  );

  // Ignore non-numeric z-index values and only keep the highest real value.
  if (!Number.isNaN(currentZIndex)) {
    topZIndex = Math.max(topZIndex, currentZIndex);
  }

  // Make this window draggable.
  dragElement(win);

  // Make this window resizable from its edge and corner handles.
  makeResizable(win);

  // Wire the help button in this window to the balloon in this same window.
  setupHelpBalloon(win);

  // Wire the close button in this window so it hides the window cleanly.
  setupCloseButton(win);

  // When the window is clicked, mark it active and bring it to the front.
  win.addEventListener("mousedown", () => {
    setActiveWindow(win);
  });
});

// PATCH: initialize launcher click behavior after all windows are set up.
setupAppLaunchers();

// PATCH: sync launcher disabled state with any windows that start open on load.
document.querySelectorAll(".draggable-window[id]").forEach((win) => {
  syncLauncherState(win);
});

// PATCH: app launchers only open windows that are currently closed.
function setupAppLaunchers() {
  document.querySelectorAll("[data-window-target]").forEach((launcher) => {
    launcher.addEventListener("click", () => {
      const targetId = launcher.dataset.windowTarget;
      const targetWindow = document.getElementById(targetId);

      if (!targetWindow) {
        return;
      }

      const isOpen = window.getComputedStyle(targetWindow).display !== "none";

      // PATCH: ignore clicks when the target window is already open.
      if (isOpen) {
        return;
      }

      targetWindow.style.display = "";
      setActiveWindow(targetWindow);

      // PATCH: once opened, gray out the launcher and disable its cursor state.
      syncLauncherState(targetWindow);
    });
  });
}

// PATCH: keep launcher icons visually in sync with whether their window is open.
function syncLauncherState(targetWindow) {
  const windowId = targetWindow.id;

  if (!windowId) {
    return;
  }

  const isOpen = window.getComputedStyle(targetWindow).display !== "none";

  document
    .querySelectorAll(`[data-window-target="${windowId}"]`)
    .forEach((launcher) => {
      launcher.classList.toggle("app-disabled", isOpen);
    });
}


// Marks one window as active and moves it above the others.
function setActiveWindow(selectedWindow) {
  // Remove the active state from every window first.
  document.querySelectorAll(".draggable-window").forEach((win) => {
    win.classList.remove("active");
  });

  // Add the active class back to the clicked window.
  selectedWindow.classList.add("active");

  // Increase the top layer counter so this window sits above previous ones.
  topZIndex += 1;

  // Apply the new top z-index directly to the selected window.
  selectedWindow.style.zIndex = topZIndex;
}

// Connects a help button to the tooltip inside the same window.
function setupHelpBalloon(win) {
  // Find the Help button inside this window.
  const helpButton = win.querySelector('button[aria-label="Help"]');

  // Find the balloon inside this window.
  const helpBalloon = win.querySelector(".help-balloon");

  // Stop here if either element is missing.
  if (!helpButton || !helpBalloon) {
    return;
  }

  // Prevent title-bar dragging when the Help button is pressed.
  helpButton.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });

  // Toggle this window's balloon when its Help button is clicked.
  helpButton.addEventListener("click", (e) => {
    e.stopPropagation();
    helpBalloon.hidden = !helpBalloon.hidden;
  });
}

// Connects a close button to hiding its own window.
function setupCloseButton(win) {
  // Find the Close button inside this window.
  const closeButton = win.querySelector('button[aria-label="Close"]');

  // Stop here if the button is missing.
  if (!closeButton) {
    return;
  }

  // Prevent title-bar dragging when the Close button is pressed.
  closeButton.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });

  // Hide this window when its Close button is clicked.
  closeButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    win.style.display = "none";

    // PATCH: re-enable the launcher icon when this window is closed.
    syncLauncherState(win);

    setTopVisibleWindowActive();
  });
}

// Makes the highest visible window active after a window is closed.
function setTopVisibleWindowActive() {
  const visibleWindows = Array.from(
    document.querySelectorAll(".draggable-window"),
  ).filter((win) => window.getComputedStyle(win).display !== "none");

  if (visibleWindows.length === 0) {
    return;
  }

  const topVisibleWindow = visibleWindows.reduce(
    (highestWindow, currentWin) => {
      const highestZIndex = Number.parseInt(
        window.getComputedStyle(highestWindow).zIndex,
        10,
      );
      const currentZIndex = Number.parseInt(
        window.getComputedStyle(currentWin).zIndex,
        10,
      );

      if (Number.isNaN(currentZIndex)) {
        return highestWindow;
      }

      if (Number.isNaN(highestZIndex) || currentZIndex > highestZIndex) {
        return currentWin;
      }

      return highestWindow;
    },
  );

  setActiveWindow(topVisibleWindow);
}

// Hide open balloons when clicking anywhere outside their button and tooltip.
document.addEventListener("click", (e) => {
  document.querySelectorAll(".draggable-window").forEach((win) => {
    const helpButton = win.querySelector('button[aria-label="Help"]');
    const helpBalloon = win.querySelector(".help-balloon");

    if (!helpButton || !helpBalloon) {
      return;
    }

    if (!helpButton.contains(e.target) && !helpBalloon.contains(e.target)) {
      helpBalloon.hidden = true;
    }
  });
});

// Converts a transform-centered window into concrete top/left coordinates.
function normalizeWindowPosition(elmnt) {
  const rect = elmnt.getBoundingClientRect();
  elmnt.style.top = rect.top + window.scrollY + "px";
  elmnt.style.left = rect.left + window.scrollX + "px";
  elmnt.style.bottom = "auto";
  elmnt.style.right = "auto";
  elmnt.style.transform = "none";
}

// Adds drag behavior to one window.
function dragElement(elmnt) {
  // Horizontal distance moved since the last mouse event.
  var pos1 = 0,
    // Vertical distance moved since the last mouse event.
    pos2 = 0,
    // Previous mouse x-position.
    pos3 = 0,
    // Previous mouse y-position.
    pos4 = 0;

  // Look for the dedicated drag handle inside this window.
  const header = elmnt.querySelector(".draggable-header");

  // If the window has a header, drag only from there.
  if (header) {
    header.onmousedown = dragMouseDown;
  } else {
    // Otherwise allow dragging from anywhere in the window.
    elmnt.onmousedown = dragMouseDown;
  }

  // Starts the drag interaction.
  function dragMouseDown(e) {
    // Support older event models if needed.
    e = e || window.event;

    // Ignore presses that start on title-bar controls.
    if (e.target.closest(".title-bar-controls") || e.target.closest("button")) {
      return;
    }

    // Prevent text selection and default browser drag behavior.
    e.preventDefault();

    // Make sure this window becomes the focused one as soon as dragging starts.
    setActiveWindow(elmnt);

    // Convert centered startup positioning into concrete coordinates first.
    normalizeWindowPosition(elmnt);

    // Store the mouse position at the moment dragging begins.
    pos3 = e.clientX;
    pos4 = e.clientY;

    // Stop dragging when the mouse button is released.
    document.onmouseup = closeDragElement;

    // Update the window position whenever the mouse moves.
    document.onmousemove = elementDrag;
  }

  // Moves the window while the mouse is being dragged.
  function elementDrag(e) {
    // Support older event models if needed.
    e = e || window.event;

    // Prevent default browser behavior while dragging.
    e.preventDefault();

    // Work out how far the mouse moved since the last event.
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;

    // Store the new mouse position for the next movement calculation.
    pos3 = e.clientX;
    pos4 = e.clientY;

    // Update the window's top position based on the mouse movement.
    elmnt.style.top = elmnt.offsetTop - pos2 + "px";

    // Update the window's left position based on the mouse movement.
    elmnt.style.left = elmnt.offsetLeft - pos1 + "px";
  }

  // Ends the drag interaction and clears the document-level handlers.
  function closeDragElement() {
    // Stop listening for mouse release events.
    document.onmouseup = null;

    // Stop listening for mouse movement events.
    document.onmousemove = null;
  }
}

// Adds edge and corner resize behavior to one window.
function makeResizable(elmnt) {
  // Find all resize handles inside this window.
  const handles = elmnt.querySelectorAll(".resize-handle");

  // Attach resize behavior to every handle.
  handles.forEach((handle) => {
    // Start resizing when a handle is pressed.
    handle.addEventListener("mousedown", (e) => {
      // Prevent default browser behavior while resizing.
      e.preventDefault();

      // Make sure the resized window is also the active window.
      setActiveWindow(elmnt);

      // Convert centered startup positioning into concrete coordinates first.
      normalizeWindowPosition(elmnt);

      // Store the mouse x-position when resizing starts.
      const startX = e.clientX;

      // Store the mouse y-position when resizing starts.
      const startY = e.clientY;

      // Store the window's left position at the start of the resize.
      const startLeft = elmnt.offsetLeft;

      // Store the window's top position at the start of the resize.
      const startTop = elmnt.offsetTop;

      // Store the window's width at the start of the resize.
      const startWidth = elmnt.offsetWidth;

      // Store the window's height at the start of the resize.
      const startHeight = elmnt.offsetHeight;

      // Resize the window whenever the mouse moves.
      document.onmousemove = (moveEvent) => {
        // Horizontal mouse movement since resize started.
        const dx = moveEvent.clientX - startX;

        // Vertical mouse movement since resize started.
        const dy = moveEvent.clientY - startY;

        // Whether this handle controls the left edge.
        const usesWestEdge =
          handle.classList.contains("w") ||
          handle.classList.contains("nw") ||
          handle.classList.contains("sw");

        // Whether this handle controls the right edge.
        const usesEastEdge =
          handle.classList.contains("e") ||
          handle.classList.contains("ne") ||
          handle.classList.contains("se");

        // Whether this handle controls the top edge.
        const usesNorthEdge =
          handle.classList.contains("n") ||
          handle.classList.contains("nw") ||
          handle.classList.contains("ne");

        // Whether this handle controls the bottom edge.
        const usesSouthEdge =
          handle.classList.contains("s") ||
          handle.classList.contains("sw") ||
          handle.classList.contains("se");

        // Left-edge resizing changes both width and the window's left position.
        if (usesWestEdge) {
          const nextWidth = Math.max(MIN_WINDOW_WIDTH, startWidth - dx);
          const widthDelta = startWidth - nextWidth;
          elmnt.style.width = nextWidth + "px";
          elmnt.style.left = startLeft + widthDelta + "px";
        }

        // Right-edge resizing only changes width.
        if (usesEastEdge) {
          elmnt.style.width =
            Math.max(MIN_WINDOW_WIDTH, startWidth + dx) + "px";
        }

        // Top-edge resizing changes both height and the window's top position.
        if (usesNorthEdge) {
          const nextHeight = Math.max(MIN_WINDOW_HEIGHT, startHeight - dy);
          const heightDelta = startHeight - nextHeight;
          elmnt.style.height = nextHeight + "px";
          elmnt.style.top = startTop + heightDelta + "px";
        }

        // Bottom-edge resizing only changes height.
        if (usesSouthEdge) {
          elmnt.style.height =
            Math.max(MIN_WINDOW_HEIGHT, startHeight + dy) + "px";
        }
      };

      // Stop resizing when the mouse button is released.
      document.onmouseup = () => {
        // Clear the resize movement handler.
        document.onmousemove = null;

        // Clear the mouse release handler.
        document.onmouseup = null;
      };
    });
  });
}


