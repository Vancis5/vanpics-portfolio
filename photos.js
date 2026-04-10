// ─────────────────────────────────────────────
//  FRANCIS EVAN — PHOTO DATA
//  This is the only file you need to edit.
// ─────────────────────────────────────────────

const photos = [
  { src:"photos/fish-eye-cosmos.webp",        title:"unnamed",               desc:"i found this at the fish market. it was still wet. i kept thinking about how much the iris looked like something larger than itself. put the crab nebula in it. felt right.",                                                                                         year:"2023", location:"maasin city, southern leyte", heroSlide:true  },
  { src:"photos/red-rectangle-sea.webp",       title:"portal",                desc:"just a rectangle from photoshop. i saw a stranger things edit on pinterest and thought — what if it was over the sea, and what if the sea reflected it back. the red wasn't planned.",                                                                               year:"2023", location:"maasin city, southern leyte", heroSlide:true  },
  { src:"photos/fog-motorcycle.webp",          title:"leaving",               desc:"early morning somewhere in southern leyte. the fog was so thick i almost missed the red taillight. i didn't. took the photo before i could think about it.",                                                                                                        year:"2023", location:"maasin city, southern leyte", heroSlide:true  },
  { src:"photos/church-tower-fog.webp",        title:"colonial",              desc:"the birds appeared for maybe three seconds. the fog had been there all morning. i had to wait for both to be true at the same time.",                                                                                                                                year:"2023", location:"maasin city, southern leyte", heroSlide:true  },
  { src:"photos/crescent-moon-tower.webp",     title:"transmission",          desc:"the alignment was real. i didn't move anything. i just pointed up and the moon happened to be exactly there, above the tower light. some things you don't manufacture.",                                                                                             year:"2024", location:"maasin city, southern leyte", heroSlide:true  },
  { src:"photos/depths.webp",                  title:"depths",                desc:"a stairwell that kept going. i went back to it a few times. something about the way the walls narrowed made me feel like i was looking at something true.",                                                                                                          year:"2023", location:"maasin city, southern leyte", heroSlide:true },
  { src:"photos/moths-light.webp",             title:"toward",                desc:"moths at a streetlight, late. they always do this. every night, same light, same instinct, same not-knowing. i think about that sometimes.",                                                                                                                         year:"2023", location:"maasin city, southern leyte", heroSlide:true },
  { src:"photos/door-crack.webp",              title:"almost",                desc:"got on the floor to take this. the light was coming in from outside and it made two clean lines on the wood. i stayed there for a while.",                                                                                                                           year:"2024", location:"maasin city, southern leyte", heroSlide:true },
  { src:"photos/broken-house-night.webp",      title:"inhabited",             desc:"walked past this at night. the warm light through the broken wood felt private, like i wasn't supposed to see it. i took the photo anyway.",                                                                                                                          year:"2024", location:"maasin city, southern leyte", heroSlide:true },
  { src:"photos/banner-sunlight.webp",         title:"procession",            desc:"somebody was holding this up and the sun came through the fabric at exactly the right angle. the fleur-de-lis became a shadow. i was there for something else.",                                                                                                     year:"2023", location:"maasin city, southern leyte", heroSlide:true },
  { src:"photos/red-rectangle-bw.webp",        title:"portal (monochrome)",   desc:"the color version is eerie. this one is quieter. less portal, more window into nothing. the reflection still lands.",                                                                                                                                               year:"2023", location:"maasin city, southern leyte", heroSlide:true },
  { src:"photos/fish-eye-bw.webp",             title:"unnamed (monochrome)",  desc:"removed the cosmos. without the color there's nothing to hold onto. just a void with texture staring back at you. the original says the universe is inside everything. this one says there's nothing inside and it's looking at you anyway.",                         year:"2023", location:"maasin city, southern leyte", heroSlide:true },
  { src:"photos/ray-of-light-bw.webp",         title:"reach",                 desc:"used to be a rainbow. desaturated it and the rainbow became a shaft of light breaking through overcast grey onto the treeline. god is reaching down but maybe not for good reasons.",                                                                               year:"2023", location:"maasin city, southern leyte", heroSlide:true },
  { src:"photos/crescent-tower-bw.webp",       title:"transmission (monochrome)", desc:"the color gradient was beautiful but this version has more weight. the grain adds to it. the alignment reads almost sacred now — like a signal going both ways.",                                                                                               year:"2024", location:"maasin city, southern leyte", heroSlide:true },
  { src:"photos/silhouette-door-sunset.webp",  title:"threshold",             desc:"the masked silhouette in the foreground, a child outside, the burning sunset through the glass. a lot happening at once but it held together.",                                                                                                                      year:"2022", location:"maasin city, southern leyte", heroSlide:true },
  { src:"photos/portrait-dappled-light.webp",  title:"dappled",               desc:"the light pattern on her face is the whole photo.",                                                                                                                                                                                                                 year:"2022", location:"maasin city, southern leyte", heroSlide:true },

  // ── FILL THESE IN ─────────────────────────
  // leave location:"" if you want to keep it private — it just won't show in the lightbox
  { src:"photos/cityscape-night.webp",         title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/lone-house-hill.webp",         title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/rainbow.webp",                 title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/bsod-building.webp",           title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/faceless-beach.webp",          title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/birds-lamppost.webp",          title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/golden-hour-portrait.webp",    title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/chess-science-room.webp",      title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/motorcycle-bridge.webp",       title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/birds-sunset.webp",            title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/bee-flower.webp",              title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/cafe-window.webp",             title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/girl-waves-rock.webp",         title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/floating-hut-sunrise.webp",    title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/figure-water-dusk.webp",       title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/beach-hat-girl.webp",          title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/upside-down-event.webp",       title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/mama-cat-kittens.webp",        title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/jeepney-ground.webp",          title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/wires-crescent-pink.webp",     title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/pink-sky-tree.webp",           title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/film-grain-sunset.webp",       title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/jungle-structure.webp",        title:"", desc:"", year:"", location:"", heroSlide:false },
  { src:"photos/ghost-sheets-sunglasses.webp", title:"", desc:"", year:"", location:"", heroSlide:false },
];
