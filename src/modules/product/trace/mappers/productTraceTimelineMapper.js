const mapProductTraceTimeline = (events) =>
  (Array.isArray(events) ? events : []).map((event, index) => ({
    sequence: index + 1,
    ...event,
  }))

module.exports = {
  mapProductTraceTimeline,
}
