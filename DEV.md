



<script id="node-async-client-config"
<script id="node-apollo-state"


JSON.parse(decodeURIComponent(document.getElementById("node-apollo-state").textContent))
JSON.parse(decodeURIComponent(document.getElementById("node-apollo-state").textContent))


- Query for buy again

Sprouts:

'https://www.instacart.com/graphql?operationName=Category&variables={"retailerInventorySessionToken":"v1.a3586da.133363758-77077-02975x19562-2-279-400145-1-0","pageViewId":"a7f8235f-70ff-5fb5-8039-b5a03702307f","orderBy":"MOST_RELEVANT","first":18,"pageSource":"your_items","categoryId":"all","shopId":"749624","postalCode":"77077","zoneId":"982"}&extensions={"persistedQuery":{"version":1,"sha256Hash":"829a2e7c0b0d8156926b64dc69afd11f0b3d4097f90679fa84a539059c131eb7"}}'


https://www.instacart.com/graphql?operationName=Category&variables=%7B%22retailerInventorySessionToken%22%3A%22v1.7d2dad9.133363758-77077-02975x19562-1-279-400145-1-0%22%2C%22pageViewId%22%3A%227d5c52c5-7c3e-5eee-b40a-4d8ef61be2c3%22%2C%22orderBy%22%3A%22MOST_RELEVANT%22%2C%22first%22%3A18%2C%22pageSource%22%3A%22your_items%22%2C%22categoryId%22%3A%22all%22%2C%22shopId%22%3A%22749573%22%2C%22postalCode%22%3A%2277077%22%2C%22zoneId%22%3A%22982%22%7D&extensions=%7B%22persistedQuery%22%3A%7B%22version%22%3A1%2C%22sha256Hash%22%3A%22829a2e7c0b0d8156926b64dc69afd11f0b3d4097f90679fa84a539059c131eb7%22%7D%7D


data.yourItemsCategory.items[0] -> only 18 (because of pagination first: 18)
data.yourItemsCategory.itemIds -> all ids

pagination, retrieve information for next page ids:

'https://www.instacart.com/graphql?operationName=Items&variables={"ids":["items_8907-26223805","items_8907-3177720","items_8907-26515270","items_8907-2629245","items_8907-23798","items_8907-80873","items_8907-19635084","items_8907-3154698","items_8907-16427995","items_8907-19928339"],"shopId":"38835","zoneId":"982","postalCode":"77077"}&extensions={"persistedQuery":{"version":1,"sha256Hash":"6474c319c75c5357b0a4f646e1d3a01dd805c5fd917d7a90906ecb84a1bad8b1"}}'


data.items[0].viewSection.trackingProperties.item_name 
'Kroger® Honeycrisp Apples – 3 Pound Bag'

items[0].viewSection.trackingProperties.product_category_name 
'Honeycrisp Apples'