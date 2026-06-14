# Aviadex

## Overview

Aviadex is an aviation collection and aircraft tracking platform inspired by the concept of a Pokédex, but focused on real-world aircraft.

The primary goal is to allow aviation enthusiasts, photographers, spotters, museums, and collectors to build a structured collection of aircraft sightings and photographs while preserving the historical lifecycle of each aircraft.

The application must be designed with long-term scalability in mind.

---

## Main Concepts

The platform distinguishes between:

* Manufacturer
* Aircraft Model
* Aircraft Variant
* Physical Aircraft
* Registration
* Operator
* Squadron
* Air Base
* Event
* Sighting
* Photograph

A physical aircraft is considered a unique airframe and remains the central entity of the database.

Registrations, operators, countries, liveries, and statuses may change during the life of an aircraft.

---

## Aircraft Hierarchy

Manufacturer
→ Model
→ Variant
→ Aircraft (airframe)
→ Sightings
→ Photos

Example:

McDonnell Douglas
→ F/A-18 Hornet
→ F/A-18C
→ J-5017

---

## Aircraft Lifecycle

An aircraft may:

* Change registration
* Change operator
* Change country
* Change military unit
* Change livery
* Be sold
* Be retired
* Be preserved in a museum
* Be scrapped

The system must preserve the complete historical timeline of the aircraft.

---

## Main Features

### Aircraft Collection

* Create aircraft records
* Search by registration
* Search by serial number
* Search by operator
* Search by country
* Search by aircraft type
* Search by squadron

### Photo Collection

* Upload photographs
* Associate photographs with sightings
* Store metadata
* Track aircraft observations over time

### World Map

The platform must provide a world map showing:

* Sighting locations
* Air bases
* Events
* Countries visited

### Aircraft History

Each aircraft may contain:

* Historical events
* Registration history
* Operator history
* Squadron history
* Status history

### Technical Reference

Technical specifications must be stored at the Variant level, not the individual aircraft level.

Example:

F/A-18C
→ speed
→ engines
→ dimensions
→ radar
→ armament

All aircraft using this variant inherit the same technical reference.

---

## Internationalization

Primary language: English

Secondary language: French

The application must be designed from the beginning for multilingual support.

All database entities should support future translations.

English must always be considered the default language.

---

## Future Features

* Collection statistics
* Missing aircraft tracking
* Squadron collections
* Special liveries
* Museum aircraft
* Aircraft timeline visualization
* Public API
* Import and export tools
* EXIF metadata extraction
* Interactive dashboards
