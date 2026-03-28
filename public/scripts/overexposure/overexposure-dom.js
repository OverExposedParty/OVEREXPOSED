const safeZone = document.querySelector(".safe-zone");
const titleText = document.querySelector(".title-text");
const titleTextContainer = document.querySelector(".title-text-container");
const contentsContainerText = document.querySelector('.contents-container-text');
const titleTextEditor = document.querySelector(".title-text-editor");
const contentsTextEditor = document.getElementById("contents-text-editor");
const floatingContainer = document.getElementById("floating-container");
const overexposureContainer = document.getElementById("overexposure-container");
const uploadingText = document.getElementById("uploading-text");
const contentsTextArea = document.querySelector("#contents-text-editor textarea");
const titleTextInput = document.getElementById("title-text-editor-input");

const exitMenuYes = document.getElementById("exit-menu-button-yes");
const exitMenuNo = document.getElementById("exit-menu-button-no");
const submitPostYes = document.getElementById("submit-post-yes");
const submitPostNo = document.getElementById("submit-post-no");
const publishButton = document.querySelector(".overexposure-publish-button");

const exitMenuContainer = document.getElementById("exit-menu-container");
const uploadingPostContainer = document.getElementById("uploading-post-container");
const areYouSurePostContainer = document.getElementById("are-you-sure-container");
const postIncompleteContainer = document.getElementById("post-incomplete-container");

const enableNSFWContainer = document.getElementById("enable-nsfw-container");

const sharePostButton = document.getElementById("share-post-button");
const deletePostButton = document.getElementById("delete-post-button");
const flagPostButton = document.getElementById("flag-post-button");

const sharePostContainer = document.getElementById("share-post-container");
const sharePostBodyTitle = sharePostContainer.querySelector(".share-post-body-title");
const sharePostBodyText = sharePostContainer.querySelector(".share-post-body-text");
const sharePostUrlInput = document.getElementById("share-post-url-input");
const sharePostCopyButton = document.getElementById("share-post-copy-button");
const deletePostContainer = document.getElementById("delete-post-container");
const deleteCodeInput = deletePostContainer.querySelector('input');
const deletePostSubmit = deletePostContainer.querySelector('.warning-button-container button');

const rememberCodeContainer = document.getElementById("remember-code-container");
const rememberCodeContinue = rememberCodeContainer.querySelector('.warning-button-container button');
const rememberCodeText = rememberCodeContainer.querySelector('input');

const textInput = document.getElementById("text-input");
const charCounter = document.getElementById("char-counter");
