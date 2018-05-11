%.zip:
	curl http://www.naturalearthdata.com/\
	http//www.naturalearthdata.com/download/110m/cultural/$@ > $@

%.shp: %.zip
	unzip $< $@

%.shx: %.zip
	unzip $< $@

%.dbf: %.zip
	unzip $< $@

%.prj: %.zip
	unzip $< $@

%.json: %.shp %.shx %.dbf %.prj
	ogr2ogr -f GeoJSON \
	-t_srs EPSG:4326 \
	-lco COORDINATE_PRECISION=6 \
	$@ $<

%.ndjson: %.json
	jq '.features' $< | \
	jq 'map(.properties |= {"label": .NAME, "iso3": .ISO_A3_EH})' | \
	jq -c '.[]' > $@

node_modules:
	npm install

venv:
	python3 -m venv venv
	./venv/bin/pip install -r requirements.txt

pleiades-places-latest.json:
	wget "http://atlantides.org/downloads/pleiades/json/$@.gz"
	gunzip "$@.gz"

pleiades-bboxes.ndjson: pleiades-places-latest.json node_modules
	node pleiades-bboxes.js > $@

all: ne_110m_admin_0_countries.ndjson

clean:
	rm -f *.shp *.shx *.dbf *.prj *.ndjson

superclean: clean
	rm -f *.zip
	rm -f pleiades-places-latest.json
	rm -rf venv
	rm -rf node_modules

view-bboxes: venv pleiades-bboxes.ndjson
	./venv/bin/jupyter notebook view-bboxes.ipynb

.PHONY: all clean superclean view-bboxes



# SELECT ?item ?itemLabel WHERE {
#   ?item wdt:P31 wd:Q6256.
#   SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
# }
