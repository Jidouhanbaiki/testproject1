from django.db import models

#from django.contrib.auth.models import User
from django.db import models


class Poster(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    given_name = models.CharField(max_length=50)
    family_name = models.CharField(max_length=50)
    email = models.EmailField()

    def __repr__(self):
        return "<Poster #{} {} {}>".format(self.id, self.given_name, self.family_name)


class Message(models.Model):
    poster = models.ForeignKey(Poster, on_delete=models.CASCADE)
    parent = models.ForeignKey('Message', on_delete=models.CASCADE, blank=True, null=True)
    text = models.TextField()
    pub_date = models.DateTimeField('publication date', auto_now_add=True)
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ['pub_date']

    def __repr__(self):
        return "<Message from {}, root: {}>".format(self.pub_date, self.poster, not bool(self.parent))
