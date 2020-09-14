FROM mongo:3.2

RUN mkdir -p /mongo/dump
COPY mongo-openmappr-starter-database.gz /mongo/mongo-openmappr-starter-database.gz
COPY mongo.sh /mongo/mongo.sh
RUN chmod 777 /mongo/mongo.sh

CMD /mongo/mongo.sh
