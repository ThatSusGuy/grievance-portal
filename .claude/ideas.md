# Portal Feature Ideas

Brainstormed with Ridit on 8 Oct 2026. Nothing here is built yet.

## What Ridit wants (read this first)

- **Interactive toys she plays with**, out of left field, like the weird web
  toys on neal.fun (Pointer Pointer, Infinite Craft, The Password Game).
- **Build once, hands-off.** No ongoing upkeep from Ridit.
- **Easy to build.**
- **NOT wanted:** trackers, counters, milestones, year-long tallies, email
  summaries, or anything that just re-skins what's already in the portal
  (e.g. a "word of the day" variant of Guess My Word).
- Auto-generated content should come from "the Court" / "the System" / "the
  Agreement", never pretend to be Ridit.

Running jokes to draw on: Bournville fixes everything, the couch, "Where my
man at 😔", "I will think about it", the Sheldon-style Relationship Agreement,
the Music Wall, angy / baby me moods.

---

## ⭐ Round 3 (Ridit loved these: "fucking brilliant")

1. **RiditOS 💻.** A fake desktop that's supposedly Ridit's computer, which
   she's "hacked into." It has a browser history ("how to make girlfriend not
   angy", "is bournville a love language", "couch back pain remedies"), a
   Recycle Bin of almost-sent texts, a password-locked "DO NOT OPEN" folder
   with hints hidden around the desktop, and a Notes.app of "secret plans."
   Content is written once. *Top pick.*
2. **Boyfriend Customer Service Hotline ☎️.** She taps Call, it rings, and an
   automated menu answers: "Thank you for calling Ridit Support. Press 1 if
   you are hungry, 2 if you need a hug, 3 to speak to a manager." It has
   nested menus and hold music from the Music Wall. Option 3 always says "The
   manager is also Ridit." *Top pick.*
3. **The Claw Machine 🕹️.** An arcade claw full of coupons ("foot massage",
   "you pick dinner", "one free win in an argument"). It's rigged to be
   annoyingly hard, and the claw slips at the last second.
4. **Kaajal's Text Adventure 🗡️.** An endless Zork-style game with Claude as
   the narrator. Example opening: "You wake up. You are hungry. Ridit is
   asleep. There is a Bournville on the top shelf. `> wake ridit`" Needs the
   Claude API, with the key kept in Apps Script.
5. **Magic Bournville Ball 🔮.** She asks a question and physically shakes
   her phone, which the device motion sensor detects. A chocolate ball turns
   over with an answer ("Signs point to Bournville", "Ask again after food").
6. **The Daily Grievance 📰.** A newspaper front-page generator. She types a
   headline and gets an old-timey front page with a Claude-written article,
   fake quotes ("'I was in a meeting,' claimed the accused"), a weather box
   and classifieds. She'll screenshot it and send it. *Strong third.*
7. **The Séance 👻.** A spooky Ouija board. The planchette spells answers
   from "The Spirit of the Relationship Agreement," a dead lawyer ghost who
   only speaks in legal clauses.
8. **Pocket Ridit 🐣.** A Tamagotchi pixel Ridit she feeds Bournville, pets
   and sends to the couch. It falls asleep mid-sentence and faints
   dramatically if ignored.

## Round 2 (liked, but not these specific ones for now)

- **Where My Man At 👉.** A Pointer Pointer clone: wherever she taps, a
  photo of Ridit pointing at that exact spot appears. Needs about 30–40
  pointing photos, taken once.
- **Infinite Us ♾️.** An Infinite Craft clone that starts with Ridit,
  Kaajal, Bournville, Couch, Hug and Angy. Combining them makes new items,
  e.g. Kaajal + Angy = Hangry Storm, and Hangry Storm + Bournville = Peace
  Treaty. Claude invents each new element.
- **The Rage Room 💥.** On an angy grievance she can fling and smash plates
  in a physics room that includes a framed photo of Ridit.
- **Forgiveness Password Game 🔐.** "Forgive him" requires a password with
  escalating rules ("must contain a chocolate brand", "must name a Music
  Wall song", "Rule 14: no letter R, sorry Ridit").
- **Haggle With Him 🤝.** She negotiates grievance compensation with a
  stubborn Sheldon-style "Boyfriend Negotiation Bot." The final deal prints
  as a signed contract.
- **Deface Him 🖍️.** A photo of Ridit plus stickers and a drawing kit
  (moustaches, horns, GUILTY stamps). She can save the result or send it.
- **The Soundboard 🎹.** A Patatap-style toy: each key or tap plays a short
  clip of Ridit with an animation. Needs about 20 clips, recorded once.

## Round 1 (mostly rejected: too tracker-ish)

- **Grievance Court ⚖️.** A Claude "judge" rules on each grievance and cites
  clauses of the Relationship Agreement PDF. *Ridit liked this one.*
- **Grievance Wrapped 🎁.** A Spotify-Wrapped-style yearly recap, which
  could also analyse an exported chat. *Liked, but too hands-on.*
- Rejected: Bournville Debt Clock, Couch Sentence Tracker, Grievance Ticket
  Tracking, "Where my man at" push alerts, Agreement Amendments, Drama
  Forecast, auto Word of the Day, Code Red alerts, mood-reactive theme,
  achievements, milestone surprises, monthly State of the Union email, Clause
  of the Day, horoscope, weekly briefing email, reverse word game, Song of the
  Day, time capsule.

---

## Technical notes

- The site is static on GitHub Pages and the backend is Google Apps Script
  (`apps-script.js`). Anything using the Claude API must keep the API key in
  Apps Script Script Properties, never in `script.js`.
- The whole repo root is deployed to the live site, including this file once
  it's on `main`.
