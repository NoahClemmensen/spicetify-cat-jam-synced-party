import {SettingsSection} from "spcr-settings";

type cat = {
    id: string;
    defaultUrl: string;
    styles: string;
    onTheRight: boolean;
}

const settings = new SettingsSection("Cat-Jam-Party Settings", "catjamparty-settings");
const elementSelectorLeft = ".main-nowPlayingBar-left";
const elementSelectorRight = ".main-nowPlayingBar-right";
const cats: cat[] = [
    {
        id: "maxwell-webm",
        defaultUrl: "https://github.com/NoahClemmensen/spicetify-cat-jam-synced-party/raw/refs/heads/main/src/resources/maxwell.webm",
        styles: "width: 65px; height: 65px;",
        onTheRight: false,
    },
    {
        id: "raver-webm",
        defaultUrl: "https://github.com/NoahClemmensen/spicetify-cat-jam-synced-party/raw/refs/heads/main/src/resources/raver.webm",
        styles: "width: 65px; height: 65px;",
        onTheRight: false,
    },
    {
        id: "animal-crossing-cat-webm",
        defaultUrl: "https://github.com/NoahClemmensen/spicetify-cat-jam-synced-party/raw/refs/heads/main/src/resources/animal%20crossing%20cat.webm",
        styles: "width: 65px; height: 65px;",
        onTheRight: false,
    },
    {
        id: "realistic-cat-webm",
        defaultUrl: "https://github.com/NoahClemmensen/spicetify-cat-jam-synced-party/raw/refs/heads/main/src/resources/realistic.webm",
        styles: "width: 65px; height: 65px;",
        onTheRight: true,
    },
    {
        id: "cat-jam-webm",
        defaultUrl: "https://github.com/NoahClemmensen/spicetify-cat-jam-synced-party/raw/refs/heads/main/src/resources/catjam.webm",
        styles: "width: 65px; height: 65px;",
        onTheRight: true,
    }
]

let audioData;

// Function to adjust the video playback rate based on the current track's BPM
async function getPlaybackRate(audioData) {
    let videoDefaultBPM = Number(settings.getFieldValue("catjamparty-webm-bpm"));
    if (!videoDefaultBPM) {
        videoDefaultBPM = 135.48;
    }

    if (audioData && audioData?.track) {
        let trackBPM = audioData?.track?.tempo  // BPM of the current track
        let bpmMethod = settings.getFieldValue("catjamparty-webm-bpm-method");
        let bpmToUse = trackBPM;
        if (bpmMethod !== "Track BPM") {
            bpmToUse = await getBetterBPM(trackBPM);
            console.log("[CAT-JAM-PARTY] Better BPM:", bpmToUse)
        }
        let playbackRate = 1;
        if (bpmToUse) {
            playbackRate = bpmToUse / videoDefaultBPM;
        }
        console.log("[CAT-JAM-PARTY] Track BPM:", trackBPM)
        console.log("[CAT-JAM-PARTY] Cat jam synchronized, playback rate set to:", playbackRate)

        return playbackRate; // Return the calculated playback rate
    } else {
        console.warn("[CAT-JAM-PARTY] BPM data not available for this track, cat will not be jamming accurately :(");
        return 1; // Return default playback rate if BPM data is not available
    }
}

// Function that fetches audio data from "wg://audio-attributes/v1/audio-analysis/" with retry handling
async function fetchAudioData(retryDelay = 200, maxRetries = 10) {
    try {
        return await Spicetify.getAudioData();
    } catch (error) {
        if (typeof error === "object" && error !== null && 'message' in error) {
            const message = error.message;

            if (message.includes("Cannot read properties of undefined") && maxRetries > 0) {
                console.log("[CAT-JAM-PARTY] Retrying to fetch audio data...");
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return fetchAudioData(retryDelay, maxRetries - 1); // Retry fetching audio data
            }
        } else {
            console.warn(`[CAT-JAM-PARTY] Error fetching audio data: ${error}`);
        }
        return null; // Return default playback rate on failure
    }
}

// Function to synchronize video playback timing with the music's beats
async function syncTiming(startTime, progress, videoElement: HTMLVideoElement) {
    if (Spicetify.Player.isPlaying()) {
        progress = progress / 1000; // Convert progress from milliseconds to seconds

        if (audioData && audioData.beats) {
            // Find the nearest upcoming beat based on current progress
            const upcomingBeat = audioData.beats.find(beat => beat.start > progress);
            if (upcomingBeat) {
                const operationTime = performance.now() - startTime; // Time taken for the operation
                const delayUntilNextBeat = Math.max(0, (upcomingBeat.start - progress) * 1000 - operationTime); // Calculate delay until the next beat

                setTimeout(() => {
                    videoElement.currentTime = 0; // Reset video to start
                    videoElement.play(); // Play the video
                }, delayUntilNextBeat);
            } else {
                videoElement.currentTime = 0; // Reset video to start if no upcoming beat
                videoElement.play();
            }
        } else {
            videoElement.currentTime = 0; // Play the video without delay if no beat information
            videoElement.play();
        }
    } else {
        videoElement.pause(); // Pause the video if Spotify is not playing
    }
}

// Function to wait for a specific DOM element to appear before proceeding
async function waitForElement(selector, maxAttempts = 50, interval = 100) {
    let attempts = 0;
    while (attempts < maxAttempts) {
        const element = document.querySelector(selector); // Attempt to find the element
        if (element) {
            return element; // Return the element if found
        }
        await new Promise(resolve => setTimeout(resolve, interval)); // Wait for a specified interval before trying again
        attempts++;
    }
    throw new Error(`Element ${selector} not found after ${maxAttempts} attempts.`); // Throw error if element not found within attempts
}

// Function that creates the WebM video and sets initial BPM and play state
async function createWebMVideo(targetElement: any, elementStyles: string, videoURL: string, elementId: string, beforeInsert: boolean = false) {
    try {
        // Create a new video element to be inserted
        const videoElement = document.createElement('video');
        videoElement.setAttribute('loop', 'true'); // Video loops continuously
        videoElement.setAttribute('autoplay', 'true'); // Video starts automatically
        videoElement.setAttribute('muted', 'true'); // Video is muted
        videoElement.setAttribute('style', elementStyles);
        videoElement.classList.add('webm-party-video'); // Add class to identify videos when reloading
        videoElement.src = videoURL; // Set the source of the video
        videoElement.id = elementId; // Assign an ID to the video element

        audioData = await fetchAudioData(); // Fetch audio data
        videoElement.playbackRate = await getPlaybackRate(audioData); // Adjust playback rate based on the song's BPM
        // Insert the video element into the target element in the DOM
        if (targetElement.firstChild && beforeInsert) {
            targetElement.insertBefore(videoElement, targetElement.firstChild);
        } else {
            targetElement.appendChild(videoElement);
        }
        // Control video playback based on whether Spotify is currently playing music
        if (Spicetify.Player.isPlaying()) {
            videoElement.play();
        } else {
            videoElement.pause();
        }
    } catch (error) {
        console.error("[CAT-JAM-PARTY] Could not create cat-jam video element: ", error);
    }
}

async function getBetterBPM(currentBPM) {
    let betterBPM = currentBPM
    try {
        const currentSongDataUri = Spicetify.Player.data?.item?.uri;
        if (!currentSongDataUri) {
            setTimeout(getBetterBPM, 200);
            return;
        }
        const uriFinal = currentSongDataUri.split(":")[2];
        const res = await Spicetify.CosmosAsync.get("https://api.spotify.com/v1/audio-features/" + uriFinal);
        const danceability = Math.round(100 * res.danceability);
        const energy = Math.round(100 * res.energy);
        betterBPM = calculateBetterBPM(danceability, energy, currentBPM)
    } catch (error) {
        console.error("[CAT-JAM-PARTY] Could not get audio features: ", error);
    } finally {
        return betterBPM;
    }
}

// Function to calculate a better BPM based on danceability and energy
function calculateBetterBPM(danceability, energy, currentBPM) {
    let danceabilityWeight = 0.9;
    let energyWeight = 0.6;
    let bpmWeight = 0.6;
    const energyTreshold = 0.5;
    let danceabilityTreshold = 0.5;
    const maxBPM = 100;
    let bpmThreshold = 0.8; // 80 bpm

    const normalizedBPM = currentBPM / 100;
    const normalizedDanceability = danceability / 100;
    const normalizedEnergy = energy / 100;

    if (normalizedDanceability < danceabilityTreshold) {
        danceabilityWeight *= normalizedDanceability;
    }

    if (normalizedEnergy < energyTreshold) {
        energyWeight *= normalizedEnergy;
    }
    // increase bpm weight if the song is slow
    if (normalizedBPM < bpmThreshold) {
        bpmWeight = 0.9;
    }

    const weightedAverage = (normalizedDanceability * danceabilityWeight + normalizedEnergy * energyWeight + normalizedBPM * bpmWeight) / (1 - danceabilityWeight + 1 - energyWeight + bpmWeight);
    let betterBPM = weightedAverage * maxBPM;

    const betterBPMForFasterSongs = settings.getFieldValue("catjam-webm-bpm-method-faster-songs") !== "Track BPM";
    if (betterBPM > currentBPM) {
        if (betterBPMForFasterSongs) {
            betterBPM = (betterBPM + currentBPM) / 2;
        } else {
            betterBPM = currentBPM;
        }
    }

    if (betterBPM < currentBPM) {
        betterBPM = Math.max(betterBPM, 70);
    }

    return betterBPM;
}

function createSettingsUI() {
    settings.addInput("catjamparty-webm-bpm", "Custom default BPM of webM video (Example: 135.48)", "");
    // Position is now permanently set to bottom player to have space for all the cats. Sorry :(
    // settings.addDropDown("catjam-webm-position", "Position where webM video should be rendered", ['Bottom (Player)', 'Left (Library)'], 0);
    settings.addDropDown("catjamparty-webm-bpm-method", "Method to calculate better BPM for slower songs", ['Track BPM', 'Danceability, Energy and Track BPM'], 0);
    settings.addDropDown("catjamparty-webm-bpm-method-faster-songs", "Method to calculate better BPM for faster songs", ['Track BPM', 'Danceability, Energy and Track BPM'], 0);
    settings.addInput("catjamparty-webm-position-left-size", "Size of webM video on the left library (Only works for left library, Default: 100)", "");
    settings.addButton("catjamparty-reload", "Reload custom values", "Save and reload", async () => {
        await createParty();
    });
    settings.pushSettings();
}

async function runCallbackOnCats(callback: (cat: HTMLVideoElement) => Promise<void>) {
    const videoElements = document.getElementsByClassName("webm-party-video");
    if (videoElements.length == 0) {
        console.error("[CAT-JAM-PARTY] Video elements not found.");
        return;
    }

    for (let i = 0; i < videoElements.length; i++) {
        const videoElement = videoElements[i];
        if (videoElement) {
            await callback(videoElement as HTMLVideoElement); // Execute the callback function on each video element
        }
    }
}

async function createParty() {
    // Remove any existing video element to avoid duplicates
    const existingVideo = Array.from(document.getElementsByClassName("webm-party-video"));
    for (let i = 0; i < existingVideo.length; i++) {
        existingVideo[i].remove();
    }

    for (let i = 0; i < cats.length; i++) {
        let targetElement = await waitForElement(cats[i].onTheRight ? elementSelectorRight : elementSelectorLeft); // Wait until the target element is available
        await createWebMVideo(targetElement, cats[i].styles, cats[i].defaultUrl, cats[i].id, cats[i].onTheRight); // Create the video element
    }
}

async function syncToSong(videoElement: HTMLVideoElement, startTime: number) {
    audioData = await fetchAudioData(); // Fetch current audio data
    if (audioData && audioData.beats && audioData.beats.length > 0) {
        const firstBeatStart = audioData.beats[0].start; // Get start time of the first beat

        // Adjust video playback rate based on the song's BPM
        videoElement.playbackRate = await getPlaybackRate(audioData);

        const operationTime = performance.now() - startTime; // Calculate time taken for operations
        const delayUntilFirstBeat = Math.max(0, firstBeatStart * 1000 - operationTime); // Calculate delay until the first beat

        setTimeout(() => {
            videoElement.currentTime = 0; // Ensure video starts from the beginning
            videoElement.play(); // Play the video
        }, delayUntilFirstBeat);
    } else {
        videoElement.playbackRate = await getPlaybackRate(audioData); // Set playback rate even if no beat information
        videoElement.currentTime = 0; // Ensure video starts from the beginning
        videoElement.play(); // Play the video
    }
}

// Main function to initialize and manage the Spicetify app extension
async function main() {
    // Continuously check until the Spicetify Player and audio data APIs are available
    while (!Spicetify?.Player?.addEventListener || !Spicetify?.getAudioData) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait for 100ms before checking again
    }
    console.log("[CAT-JAM-PARTY] Extension loaded.");
    let audioData; // Initialize audio data variable

    // Create settings UI for the extension
    createSettingsUI()

    // Style the left side of the player to not wrap
    const leftArea = await waitForElement(elementSelectorLeft);
    if (leftArea) {
        leftArea.setAttribute("style", "display: flex; flex-wrap: nowrap; align-items: center;");
    }

    // Create initial WebM video
    await createParty();

    // Add event listeners for player state changes
    Spicetify.Player.addEventListener("onplaypause", async () => {
        const startTime = performance.now();
        let progress = Spicetify.Player.getProgress();
        lastProgress = progress;
        await runCallbackOnCats(async (videoElement) => {
            await syncTiming(startTime, progress, videoElement); // Synchronize video timing with the current progress
        });
    });

    let lastProgress = 0; // Initialize last known progress
    Spicetify.Player.addEventListener("onprogress", async () => {
        const currentTime = performance.now();
        let progress = Spicetify.Player.getProgress();

        // Check if a significant skip in progress has occurred or if a significant time has passed
        if (Math.abs(progress - lastProgress) >= 500) {
            await runCallbackOnCats(async (videoElement) => {
                await syncTiming(currentTime, progress, videoElement); // Synchronize video timing again
            });
        }
        lastProgress = progress; // Update last known progress
    });

    Spicetify.Player.addEventListener("songchange", async () => {
        const startTime = performance.now(); // Record the start time for the operation
        lastProgress = Spicetify.Player.getProgress();

        await runCallbackOnCats(async (videoElement) => {
            await syncToSong(videoElement, startTime);
        });
    });
}

export default main; // Export the main function for use in the application