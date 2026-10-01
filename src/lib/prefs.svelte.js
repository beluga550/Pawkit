export const PREFS_KEY = "pawkit.prefs.v1";

export function createPrefs({ storage }) {
  const saved = storage.read(PREFS_KEY, {});
  let realAvatars = $state(typeof saved?.realAvatars === "boolean" ? saved.realAvatars : true);
  return {
    get realAvatars() {
      return realAvatars;
    },
    set realAvatars(value) {
      realAvatars = Boolean(value);
      storage.write(PREFS_KEY, { realAvatars });
    },
  };
}
