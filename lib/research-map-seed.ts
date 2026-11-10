import type { ResearchMap } from "@/lib/research-map";

// The November 2026 redraw of the portfolio Research Framework, used as the starting map.
export const seedMap: ResearchMap = {
 "version": 1,
 "width": 2400,
 "height": 1500,
 "title": "Research Framework",
 "subtitle": "A working map of the influences, methods and outcomes of my research",
 "axes": {
  "material": {
   "label": "Material Systems",
   "color": "#C4572B"
  },
  "structure": {
   "label": "Structural Logics",
   "color": "#2459A8"
  },
  "computation": {
   "label": "Computation & AI",
   "color": "#8E3B8F"
  }
 },
 "columns": [
  {
   "title": "Foundations",
   "subtitle": "what the work draws on",
   "x0": 60,
   "x1": 800
  },
  {
   "title": "Methods",
   "subtitle": "what I develop and test",
   "x0": 800,
   "x1": 1700
  },
  {
   "title": "Outcomes",
   "subtitle": "what the work produces",
   "x0": 1700,
   "x1": 2340
  }
 ],
 "zone": {
  "x": 1050,
  "y": 555,
  "w": 615,
  "h": 190,
  "title": "Core contribution"
 },
 "strands": [
  {
   "id": "s1",
   "axis": "material",
   "points": [
    [
     110,
     300
    ],
    [1020, 300],
    [
     1060,
     340
    ],
    [
     2265,
     340
    ]
   ]
  },
  {
   "id": "s2",
   "axis": "material",
   "points": [
    [
     110,
     410
    ],
    [
     760,
     410
    ],
    [
     972,
     622
    ],
    [
     1700,
     622
    ],
    [
     2060,
     982
    ],
    [
     2265,
     982
    ]
   ]
  },
  {
   "id": "s3",
   "axis": "structure",
   "points": [
    [
     110,
     530
    ],
    [
     880,
     530
    ],
    [
     990,
     640
    ],
    [
     1690,
     640
    ],
    [2050, 1000],
    [
     2265,
     1000
    ]
   ]
  },
  {
   "id": "s4",
   "axis": "structure",
   "points": [
    [
     110,
     640
    ],
    [
     560,
     640
    ],
    [
     740,
     460
    ],
    [
     2265,
     460
    ]
   ]
  },
  {
   "id": "s5",
   "axis": "structure",
   "points": [
    [
     110,
     750
    ],
    [
     570,
     750
    ],
    [
     843,
     477
    ],
    [
     2265,
     477
    ]
   ]
  },
  {
   "id": "s6",
   "axis": "computation",
   "points": [
    [
     110,
     880
    ],
    [
     1720,
     880
    ],
    [
     1840,
     760
    ],
    [
     2265,
     760
    ]
   ]
  },
  {
   "id": "s7",
   "axis": "computation",
   "points": [
    [
     110,
     1000
    ],
    [
     1700,
     1000
    ],
    [
     1750,
     1050
    ],
    [
     2265,
     1050
    ]
   ]
  },
  {
   "id": "s8",
   "axis": "computation",
   "points": [
    [
     840,
     1150
    ],
    [
     870,
     1150
    ],
    [
     1362,
     658
    ],
    [
     1680,
     658
    ],
    [2040, 1018],
    [
     2265,
     1018
    ]
   ]
  }
 ],
 "items": [
  {
   "id": "i1",
   "name": "Healthy Materials",
   "kind": "concept",
   "main": false,
   "x": 380,
   "y": 262,
   "anchor": "start",
   "feeds": {
    "strand": "s1",
    "at": [
     560,
     300
    ],
    "route": "under"
   }
  },
  {
   "id": "i2",
   "name": "Material Ethics",
   "kind": "concept",
   "main": false,
   "x": 330,
   "y": 350,
   "anchor": "start",
   "feeds": {
    "strand": "s1",
    "at": [
     620,
     300
    ],
    "route": "under"
   }
  },
  {
   "id": "i3",
   "name": "Bio-Binders",
   "kind": "concept",
   "main": false,
   "x": 100,
   "y": 352,
   "anchor": "start",
   "feeds": {
    "strand": "s2",
    "at": [
     330,
     410
    ],
    "route": "under"
   }
  },
  {
   "id": "i4",
   "name": "Seaweed",
   "kind": "concept",
   "main": false,
   "x": 420,
   "y": 450,
   "anchor": "start",
   "feeds": {
    "strand": "s2",
    "at": [
     640,
     410
    ],
    "route": "under"
   }
  },
  {
   "id": "i5",
   "name": "Giuseppe Fallacara",
   "kind": "person",
   "main": false,
   "x": 80,
   "y": 488,
   "anchor": "start",
   "feeds": {
    "strand": "s3",
    "at": [
     420,
     530
    ],
    "route": "under"
   }
  },
  {
   "id": "i6",
   "name": "Compression Logic",
   "kind": "concept",
   "main": false,
   "x": 470,
   "y": 488,
   "anchor": "start",
   "feeds": {
    "strand": "s3",
    "at": [
     720,
     530
    ],
    "route": "under"
   }
  },
  {
   "id": "i7",
   "name": "Masonry",
   "kind": "technique",
   "main": false,
   "x": 330,
   "y": 580,
   "anchor": "start",
   "feeds": {
    "strand": "s3",
    "at": [
     520,
     530
    ],
    "route": "under"
   }
  },
  {
   "id": "i8",
   "name": "Stone Cutting",
   "kind": "technique",
   "main": false,
   "x": 460,
   "y": 600,
   "anchor": "start",
   "feeds": {
    "strand": "s3",
    "at": [
     640,
     530
    ],
    "route": "under"
   }
  },
  {
   "id": "i9",
   "name": "Discrete Assemblies",
   "kind": "concept",
   "main": false,
   "x": 80,
   "y": 595,
   "anchor": "start",
   "feeds": {
    "strand": "s3",
    "at": [
     330,
     530
    ],
    "route": "under"
   }
  },
  {
   "id": "i10",
   "name": "Heinz Isler",
   "kind": "person",
   "main": false,
   "x": 80,
   "y": 690,
   "anchor": "start",
   "feeds": {
    "strand": "s4",
    "at": [
     330,
     640
    ],
    "route": "under"
   }
  },
  {
   "id": "i11",
   "name": "Minimal Surface",
   "kind": "concept",
   "main": false,
   "x": 340,
   "y": 700,
   "anchor": "start",
   "feeds": {
    "strand": "s4",
    "at": [
     480,
     640
    ],
    "route": "under"
   }
  },
  {
   "id": "i12",
   "name": "Pier Luigi Nervi",
   "kind": "person",
   "main": false,
   "x": 80,
   "y": 800,
   "anchor": "start",
   "feeds": {
    "strand": "s5",
    "at": [
     300,
     750
    ],
    "route": "under"
   }
  },
  {
   "id": "i13",
   "name": "Shells",
   "kind": "concept",
   "main": false,
   "x": 330,
   "y": 800,
   "anchor": "start",
   "feeds": {
    "strand": "s5",
    "at": [
     470,
     750
    ],
    "route": "under"
   }
  },
  {
   "id": "i14",
   "name": "Vaulting",
   "kind": "concept",
   "main": false,
   "x": 80,
   "y": 830,
   "anchor": "start",
   "feeds": {
    "strand": "s5",
    "at": [
     420,
     750
    ],
    "route": "under"
   }
  },
  {
   "id": "i15",
   "name": "Neil Leach",
   "kind": "person",
   "main": false,
   "x": 80,
   "y": 935,
   "anchor": "start",
   "feeds": {
    "strand": "s6",
    "at": [
     300,
     880
    ],
    "route": "under"
   }
  },
  {
   "id": "i16",
   "name": "Matias del Campo",
   "kind": "person",
   "main": false,
   "x": 230,
   "y": 955,
   "anchor": "start",
   "feeds": {
    "strand": "s6",
    "at": [
     470,
     880
    ],
    "route": "under"
   }
  },
  {
   "id": "i17",
   "name": "Daniel Bolojan",
   "kind": "person",
   "main": false,
   "x": 470,
   "y": 935,
   "anchor": "start",
   "feeds": {
    "strand": "s6",
    "at": [
     660,
     880
    ],
    "route": "under"
   }
  },
  {
   "id": "i18",
   "name": "Diffusion",
   "kind": "technique",
   "main": false,
   "x": 470,
   "y": 850,
   "anchor": "start",
   "feeds": {
    "strand": "s6",
    "at": [
     600,
     880
    ],
    "route": "under"
   }
  },
  {
   "id": "i19",
   "name": "Dataset",
   "kind": "technique",
   "main": false,
   "x": 620,
   "y": 850,
   "anchor": "start",
   "feeds": {
    "strand": "s6",
    "at": [
     780,
     880
    ],
    "route": "under"
   }
  },
  {
   "id": "i20",
   "name": "Grasshopper",
   "kind": "technique",
   "main": false,
   "x": 80,
   "y": 1060,
   "anchor": "start",
   "feeds": {
    "strand": "s7",
    "at": [
     330,
     1000
    ],
    "route": "under"
   }
  },
  {
   "id": "i21",
   "name": "Procedural Modeling",
   "kind": "technique",
   "main": false,
   "x": 280,
   "y": 1090,
   "anchor": "start",
   "feeds": {
    "strand": "s7",
    "at": [
     560,
     1000
    ],
    "route": "under"
   }
  },
  {
   "id": "i22",
   "name": "Generative Design",
   "kind": "technique",
   "main": false,
   "x": 560,
   "y": 1060,
   "anchor": "start",
   "feeds": {
    "strand": "s7",
    "at": [
     900,
     1000
    ],
    "route": "under"
   }
  },
  {
   "id": "i23",
   "name": "Robotics",
   "kind": "technique",
   "main": false,
   "x": 560,
   "y": 1185,
   "anchor": "start",
   "feeds": {
    "strand": "s8",
    "at": [
     920,
     1100
    ],
    "route": "under"
   }
  },
  {
   "id": "i24",
   "name": "Computational Craft",
   "kind": "concept",
   "main": false,
   "x": 560,
   "y": 1240,
   "anchor": "start",
   "feeds": {
    "strand": "s8",
    "at": [
     880,
     1140
    ],
    "route": "under"
   }
  },
  {
   "id": "i25",
   "name": "Ornament",
   "kind": "concept",
   "main": false,
   "x": 330,
   "y": 1215,
   "anchor": "start",
   "feeds": {
    "strand": "s8",
    "at": [
     845,
     1150
    ],
    "route": "level"
   }
  },
  {
   "id": "i26",
   "name": "Frei Otto",
   "kind": "person",
   "main": false,
   "x": 850,
   "y": 375,
   "anchor": "start",
   "feeds": {
    "strand": "s4",
    "at": [
     1020,
     460
    ],
    "route": "under"
   }
  },
  {
   "id": "i27",
   "name": "Gaudí",
   "kind": "person",
   "main": false,
   "x": 990,
   "y": 395,
   "anchor": "start",
   "feeds": {
    "strand": "s4",
    "at": [
     1120,
     460
    ],
    "route": "under"
   }
  },
  {
   "id": "i28",
   "name": "Chris Williams",
   "kind": "person",
   "main": false,
   "x": 1110,
   "y": 375,
   "anchor": "start",
   "feeds": {
    "strand": "s4",
    "at": [
     1390,
     460
    ],
    "route": "under"
   }
  },
  {
   "id": "i29",
   "name": "Shell Behavior",
   "kind": "concept",
   "main": false,
   "x": 1180,
   "y": 530,
   "anchor": "start",
   "feeds": {
    "strand": "s5",
    "at": [
     1250,
     477
    ],
    "route": "under"
   }
  },
  {
   "id": "i30",
   "name": "Block Research Group",
   "kind": "person",
   "main": false,
   "x": 1300,
   "y": 530,
   "anchor": "start",
   "feeds": {
    "strand": "s5",
    "at": [
     1560,
     477
    ],
    "route": "under"
   }
  },
  {
   "id": "i31",
   "name": "Simulation Informed Design",
   "kind": "technique",
   "main": false,
   "x": 1420,
   "y": 395,
   "anchor": "start",
   "feeds": {
    "strand": "s4",
    "at": [
     1760,
     460
    ],
    "route": "under"
   }
  },
  {
   "id": "i32",
   "name": "Form Active Systems",
   "kind": "concept",
   "main": false,
   "x": 1780,
   "y": 525,
   "anchor": "start",
   "feeds": {
    "strand": "s5",
    "at": [
     1960,
     477
    ],
    "route": "under"
   }
  },
  {
   "id": "i33",
   "name": "Brandon Clifford",
   "kind": "person",
   "main": false,
   "x": 1460,
   "y": 535,
   "anchor": "start",
   "feeds": {
    "strand": "s3",
    "at": [
     1658,
     640
    ],
    "route": "under"
   }
  },
  {
   "id": "i34",
   "name": "Topology",
   "kind": "concept",
   "main": false,
   "x": 1180,
   "y": 1060,
   "anchor": "start",
   "feeds": {
    "strand": "s7",
    "at": [
     1300,
     1000
    ],
    "route": "under"
   }
  },
  {
   "id": "i35",
   "name": "Optimization",
   "kind": "technique",
   "main": false,
   "x": 1300,
   "y": 1090,
   "anchor": "start",
   "feeds": {
    "strand": "s7",
    "at": [
     1470,
     1000
    ],
    "route": "under"
   }
  },
  {
   "id": "i36",
   "name": "Emergence",
   "kind": "concept",
   "main": false,
   "x": 1480,
   "y": 850,
   "anchor": "start",
   "feeds": {
    "strand": "s6",
    "at": [
     1650,
     880
    ],
    "route": "under"
   }
  },
  {
   "id": "i37",
   "name": "Circular Material",
   "kind": "concept",
   "main": false,
   "x": 1780,
   "y": 285,
   "anchor": "start",
   "feeds": {
    "strand": "s1",
    "at": [
     1980,
     340
    ],
    "route": "under"
   }
  },
  {
   "id": "i38",
   "name": "Upcycled Limestone",
   "kind": "concept",
   "main": false,
   "x": 2030,
   "y": 385,
   "anchor": "start",
   "feeds": {
    "strand": "s1",
    "at": [
     2110,
     340
    ],
    "route": "under"
   }
  },
  {
   "id": "i39",
   "name": "Baroque Architecture",
   "kind": "concept",
   "main": false,
   "x": 1830,
   "y": 700,
   "anchor": "start",
   "feeds": {
    "strand": "s6",
    "at": [
     1995,
     760
    ],
    "route": "end"
   }
  },
  {
   "id": "i40",
   "name": "Gothic Architecture",
   "kind": "concept",
   "main": false,
   "x": 2040,
   "y": 700,
   "anchor": "start",
   "feeds": {
    "strand": "s6",
    "at": [
     2020,
     760
    ],
    "route": "start"
   }
  },
  {
   "id": "i41",
   "name": "Scherk Surface",
   "kind": "concept",
   "main": false,
   "x": 1975,
   "y": 805,
   "anchor": "start",
   "feeds": {
    "strand": "s6",
    "at": [
     2100,
     760
    ],
    "route": "end"
   }
  },
  {
   "id": "i42",
   "name": "Hyperbolic",
   "kind": "concept",
   "main": false,
   "x": 2125,
   "y": 805,
   "anchor": "start",
   "feeds": {
    "strand": "s6",
    "at": [
     2215,
     760
    ],
    "route": "end"
   }
  },
  {
   "id": "i43",
   "name": "Industry Collaboration",
   "kind": "concept",
   "main": false,
   "x": 1730,
   "y": 960,
   "anchor": "start",
   "feeds": {
    "strand": "s2",
    "at": [
     2110,
     982
    ],
    "route": "end"
   }
  },
  {
   "id": "i44",
   "name": "Material Systems",
   "kind": "concept",
   "main": true,
   "x": 135,
   "y": 288,
   "anchor": "start",
   "marker": {
    "type": "start",
    "x": 110,
    "y": 300,
    "strand": "s1"
   }
  },
  {
   "id": "i45",
   "name": "Bio Materials",
   "kind": "concept",
   "main": true,
   "x": 135,
   "y": 398,
   "anchor": "start",
   "marker": {
    "type": "start",
    "x": 110,
    "y": 410,
    "strand": "s2"
   }
  },
  {
   "id": "i46",
   "name": "Stereotomy",
   "kind": "concept",
   "main": true,
   "x": 135,
   "y": 518,
   "anchor": "start",
   "marker": {
    "type": "start",
    "x": 110,
    "y": 530,
    "strand": "s3"
   }
  },
  {
   "id": "i47",
   "name": "Form Finding",
   "kind": "concept",
   "main": true,
   "x": 135,
   "y": 628,
   "anchor": "start",
   "marker": {
    "type": "start",
    "x": 110,
    "y": 640,
    "strand": "s4"
   }
  },
  {
   "id": "i48",
   "name": "Structural Logic",
   "kind": "concept",
   "main": true,
   "x": 135,
   "y": 738,
   "anchor": "start",
   "marker": {
    "type": "start",
    "x": 110,
    "y": 750,
    "strand": "s5"
   }
  },
  {
   "id": "i49",
   "name": "Artificial Intelligence",
   "kind": "technique",
   "main": true,
   "x": 135,
   "y": 868,
   "anchor": "start",
   "marker": {
    "type": "start",
    "x": 110,
    "y": 880,
    "strand": "s6"
   }
  },
  {
   "id": "i50",
   "name": "Computational Design",
   "kind": "technique",
   "main": true,
   "x": 135,
   "y": 988,
   "anchor": "start",
   "marker": {
    "type": "start",
    "x": 110,
    "y": 1000,
    "strand": "s7"
   }
  },
  {
   "id": "i51",
   "name": "Digital Fabrication",
   "kind": "technique",
   "main": true,
   "x": 822,
   "y": 1157,
   "anchor": "end",
   "marker": {
    "type": "start",
    "x": 840,
    "y": 1150,
    "strand": "s8"
   }
  },
  {
   "id": "i52",
   "name": "Non-Linear Form Finding",
   "kind": "concept",
   "main": true,
   "x": 1022,
   "y": 448,
   "anchor": "start",
   "marker": {
    "type": "interchange",
    "x": 1000,
    "y": 460,
    "y2": 477
   }
  },
  {
   "id": "i53",
   "name": "Stone Bio Materials",
   "kind": "concept",
   "main": true,
   "x": 1075,
   "y": 600,
   "anchor": "start",
   "marker": {
    "type": "stop",
    "x": 1110,
    "y": 622,
    "strand": "s2"
   }
  },
  {
   "id": "i54",
   "name": "Additive\nStereotomy",
   "kind": "technique",
   "main": true,
   "x": 1440,
   "y": 698,
   "anchor": "start",
   "marker": {
    "type": "interchange",
    "x": 1405,
    "y": 622,
    "y2": 658
   }
  },
  {
   "id": "i55",
   "name": "Deposition",
   "kind": "technique",
   "main": true,
   "x": 968,
   "y": 1077,
   "anchor": "start",
   "marker": {
    "type": "stop",
    "x": 950,
    "y": 1070,
    "strand": "s8"
   }
  },
  {
   "id": "i56",
   "name": "3D Printing",
   "kind": "technique",
   "main": true,
   "x": 1098,
   "y": 947,
   "anchor": "start",
   "marker": {
    "type": "stop",
    "x": 1080,
    "y": 940,
    "strand": "s8"
   }
  },
  {
   "id": "i57",
   "name": "Binder Jetting",
   "kind": "technique",
   "main": true,
   "x": 1268,
   "y": 777,
   "anchor": "start",
   "marker": {
    "type": "stop",
    "x": 1250,
    "y": 770,
    "strand": "s8"
   }
  },
  {
   "id": "i58",
   "name": "Geometry Pipeline",
   "kind": "technique",
   "main": true,
   "x": 1560,
   "y": 1030,
   "anchor": "middle",
   "marker": {
    "type": "stop",
    "x": 1560,
    "y": 1000,
    "strand": "s7"
   }
  },
  {
   "id": "i59",
   "name": "Material Ecology",
   "kind": "concept",
   "main": true,
   "x": 2235,
   "y": 325,
   "anchor": "end",
   "marker": {
    "type": "outcome",
    "x": 2265,
    "y": 340,
    "strand": "s1"
   }
  },
  {
   "id": "i60",
   "name": "Structural Prototypes",
   "kind": "output",
   "main": true,
   "x": 2232,
   "y": 438,
   "anchor": "end",
   "marker": {
    "type": "outcome",
    "x": 2265,
    "y": 460,
    "y2": 477,
    "strand": "s4"
   }
  },
  {
   "id": "i61",
   "name": "Novel Aesthetics",
   "kind": "concept",
   "main": true,
   "x": 2235,
   "y": 745,
   "anchor": "end",
   "marker": {
    "type": "outcome",
    "x": 2265,
    "y": 760,
    "strand": "s6"
   }
  },
  {
   "id": "i62",
   "name": "Architectural Products",
   "kind": "output",
   "main": true,
   "x": 2232,
   "y": 1095,
   "anchor": "end",
   "marker": {
    "type": "outcome",
    "x": 2265,
    "y": 982,
    "y2": 1050
   }
  },
  {
   "id": "i63",
   "name": "Facade Systems",
   "kind": "output",
   "main": false,
   "x": 1800,
   "y": 1160,
   "anchor": "start",
   "from": "i62"
  },
  {
   "id": "i64",
   "name": "Columns",
   "kind": "output",
   "main": false,
   "x": 2065,
   "y": 1160,
   "anchor": "start",
   "from": "i62"
  },
  {
   "id": "i65",
   "name": "Interior Assemblies",
   "kind": "output",
   "main": false,
   "x": 1800,
   "y": 1202,
   "anchor": "start",
   "from": "i62"
  },
  {
   "id": "i66",
   "name": "Acoustic Panels",
   "kind": "output",
   "main": false,
   "x": 2065,
   "y": 1202,
   "anchor": "start",
   "from": "i62"
  },
  {
   "id": "i67",
   "name": "Exhibition Artifacts",
   "kind": "output",
   "main": false,
   "x": 1800,
   "y": 1244,
   "anchor": "start",
   "from": "i62"
  },
  {
   "id": "i68",
   "name": "Furniture Systems",
   "kind": "output",
   "main": false,
   "x": 2065,
   "y": 1244,
   "anchor": "start",
   "from": "i62"
  }
 ],
 "projects": [
  {
   "id": "p1",
   "code": "P1",
   "name": "",
   "x": 1345,
   "y": 588,
   "note": "The core: stone bio materials meet additive stereotomy"
  },
  {
   "id": "p2",
   "code": "P2",
   "name": "",
   "x": 1310,
   "y": 468,
   "note": "Non-linear form finding"
  },
  {
   "id": "p3",
   "code": "P3",
   "name": "",
   "x": 1640,
   "y": 1000,
   "note": "Geometry pipeline"
  },
  {
   "id": "p4",
   "code": "P4",
   "name": "",
   "x": 1900,
   "y": 340,
   "note": "Material ecology"
  },
  {
   "id": "p5",
   "code": "P5",
   "name": "",
   "x": 1960,
   "y": 760,
   "note": "Novel aesthetics, where AI meets precedent"
  },
  {
   "id": "p6",
   "code": "P6",
   "name": "",
   "x": 2140,
   "y": 982,
   "note": "Architectural products"
  }
 ],
 "caption": "Read left to right: from the foundations I draw on, through the methods I develop, to the outcomes the work produces. Each thick line is one strand of my research, colored by axis. Where strands of different colors meet, the axes combine. The highlighted interchange, Additive Stereotomy, is the core of my contribution. Thin dashed lines are the people, precedents and ideas that feed a strand. This is a working tool I revise throughout my tenure process, so it is always evolving."
};
