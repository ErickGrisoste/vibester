ALTER TABLE feed_keyspace.feed_by_user
    ADD media list<frozen<media_item>>;
