const EXTENSION_META_NAME = "tom-extension-id";
const DISCOVERY_EVENT = "tom-extension-discovery";
const READY_EVENT = "tom-extension-ready";

function publishExtensionIdentity(): void {
	let marker = document.querySelector<HTMLMetaElement>(
		`meta[name="${EXTENSION_META_NAME}"]`,
	);
	if (!marker) {
		marker = document.createElement("meta");
		marker.name = EXTENSION_META_NAME;
		(document.head ?? document.documentElement).append(marker);
	}
	marker.content = chrome.runtime.id;
	window.dispatchEvent(
		new CustomEvent(READY_EVENT, {
			detail: { extensionId: chrome.runtime.id },
		}),
	);
}

window.addEventListener(DISCOVERY_EVENT, publishExtensionIdentity);

if (document.documentElement) {
	publishExtensionIdentity();
} else {
	document.addEventListener("readystatechange", publishExtensionIdentity, {
		once: true,
	});
}
