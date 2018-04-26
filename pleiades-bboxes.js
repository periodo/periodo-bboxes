const R = require('ramda')
    , pleiades = require('./pleiades-places-latest.json')

const getAttestedPeriods = place => R.uniq(
  R.map(
    R.prop('timePeriod'),
    R.concat(
      R.chain(R.prop('attestations'), R.prop('locations', place)),
      R.chain(R.prop('attestations'), R.prop('names', place))
    )
  )
)

const bboxWidth  = bbox => bbox[2] - bbox[0]
const bboxHeight = bbox => bbox[3] - bbox[1]
const bboxArea   = bbox => (bboxWidth(bbox) * bboxHeight(bbox))

const sortByBboxArea = R.sortWith([
  R.descend(R.compose(bboxArea, R.prop('bbox')))
])

const findContainingBox = (bbox1, bbox2) => (
  [ R.min(bbox1[0], bbox2[0]),  // W
    R.min(bbox1[1], bbox2[1]),  // S
    R.max(bbox1[2], bbox2[2]),  // E
    R.max(bbox1[3], bbox2[3]) ] // N
)

const containedBy = bbox => place => (
  bbox[0] < place.bbox[0] &&
  bbox[1] < place.bbox[1] &&
  bbox[2] > place.bbox[2] &&
  bbox[3] > place.bbox[3]
)

const findGreatestExtent = (extent1, extent2) => {
  const bbox = findContainingBox(extent1.bbox, extent2.bbox)
  if (R.equals(extent1.bbox, bbox)) {
    return extent1
  }
  const places = R.reject(
    containedBy(bbox),
    R.concat(extent1.places, extent2.places)
  )
  return {bbox, places}
}

const geometryOf = ([w, s, e, n]) => (
  { type: 'Polygon'
  , coordinates: [[[w,s], [e,s], [e,n], [w,n], [w,s]]]
  }
)

const toWSEN = bbox => ([w,s,e,n], place) => (
  [ place.bbox[0] == bbox[0] ? place : w
  , place.bbox[1] == bbox[1] ? place : s
  , place.bbox[2] == bbox[2] ? place : e
  , place.bbox[3] == bbox[3] ? place : n
  ]
)

const labelFor = bbox => R.pipe(
  R.reduce(toWSEN(bbox), Array(4).fill(null)),
  R.uniq,
  R.map(R.prop('title')),
  R.join(' to ')
)

const pairToFeature = ([period, {bbox, places}]) => {

  return (
    { type: 'Feature'
    , properties:
        { id: `https://perio.do/.well-known/genid/pleiades/${period}`
        , label: labelFor(bbox)(places)
        , alternateLabels: []
        , places
        }
    , bbox
    , geometry: geometryOf(bbox)
    }
  )
}

const toPeriodExtents = (periodExtents, place) => {
  const attestedPeriods = getAttestedPeriods(place)
      , extent = (
          { bbox: place.bbox
          , places: [R.pick(['uri', 'title', 'bbox'], place)]
          })

  return R.mergeWith(
    findGreatestExtent,
    periodExtents,
    R.zipObj(attestedPeriods, Array(attestedPeriods.length).fill(extent))
  )
}

R.pipe(
  R.prop('@graph'),
  R.reject(R.compose(R.isNil, R.prop('bbox'))),
  sortByBboxArea,
  R.reduce(toPeriodExtents, {}),
  R.toPairs,
  R.map(pairToFeature),
  R.map(R.pipe(JSON.stringify, console.log)) //eslint-disable-line no-console
)(pleiades)
